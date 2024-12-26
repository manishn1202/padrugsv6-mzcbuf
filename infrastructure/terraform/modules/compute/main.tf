# Provider configuration with required version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ECS Cluster with container insights and capacity providers
resource "aws_ecs_cluster" "main" {
  name = "${var.environment}-pa-system"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 1
    base            = 1
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-pa-system-cluster"
  })
}

# Application Load Balancer for high availability
resource "aws_lb" "main" {
  name               = "${var.environment}-pa-system-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = var.public_subnet_ids

  enable_deletion_protection = true
  enable_http2             = true
  idle_timeout            = 60

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb-logs"
    enabled = true
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-pa-system-alb"
  })
}

# ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.environment}-pa-system-alb-sg"
  description = "Security group for PA System ALB"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-pa-system-alb-sg"
  })
}

# ECS Task Definition for backend service
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.environment}-pa-system-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn           = var.ecs_task_role_arn

  container_definitions = jsonencode([
    {
      name         = "backend"
      image        = "${var.container_image}"
      cpu          = var.cpu
      memory       = var.memory
      essential    = true
      
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}-pa-system"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "AWS_REGION"
          value = var.aws_region
        }
      ]
    }
  ])

  tags = merge(var.tags, {
    Name = "${var.environment}-pa-system-backend-task"
  })
}

# ECS Service with auto-scaling
resource "aws_ecs_service" "backend" {
  name                               = "${var.environment}-pa-system-backend"
  cluster                            = aws_ecs_cluster.main.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 120

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = var.container_port
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  tags = merge(var.tags, {
    Name = "${var.environment}-pa-system-backend-service"
  })
}

# Auto-scaling configuration
resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu" {
  name               = "${var.environment}-pa-system-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = var.cpu_utilization_threshold
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Outputs for reference by other modules
output "ecs_cluster_id" {
  description = "ID of the ECS cluster"
  value       = aws_ecs_cluster.main.id
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}