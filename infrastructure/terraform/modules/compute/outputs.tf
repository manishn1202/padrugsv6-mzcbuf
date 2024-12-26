# ECS Cluster outputs
output "ecs_cluster_id" {
  description = "ID of the ECS cluster for service deployment and task execution"
  value       = aws_ecs_cluster.main.id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster for service and task references"
  value       = aws_ecs_cluster.main.name
}

# ECS Service outputs
output "ecs_service_id" {
  description = "ID of the ECS service running the backend application"
  value       = aws_ecs_service.backend.id
}

output "ecs_service_name" {
  description = "Name of the ECS service for task deployment and updates"
  value       = aws_ecs_service.backend.name
}

# Application Load Balancer outputs
output "alb_dns_name" {
  description = "DNS name of the application load balancer for Route 53 configuration"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID of the ALB for Route 53 alias records"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the application load balancer for listener and target group configuration"
  value       = aws_lb.main.arn
}

# Auto-scaling outputs
output "ecs_service_desired_count" {
  description = "Desired number of tasks for the ECS service"
  value       = aws_ecs_service.backend.desired_count
}

output "ecs_service_min_capacity" {
  description = "Minimum capacity for auto-scaling"
  value       = var.min_capacity
}

output "ecs_service_max_capacity" {
  description = "Maximum capacity for auto-scaling"
  value       = var.max_capacity
}

# Health check outputs
output "health_check_path" {
  description = "Health check path for monitoring service status"
  value       = var.health_check_path
}

# Container configuration outputs
output "container_port" {
  description = "Port exposed by the container for application traffic"
  value       = var.container_port
}

# Security outputs
output "alb_security_group_id" {
  description = "ID of the security group attached to the ALB"
  value       = aws_security_group.alb.id
}

# Resource tagging outputs
output "environment_tag" {
  description = "Environment tag for resource identification"
  value       = var.environment
}