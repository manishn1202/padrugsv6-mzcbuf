# VPC Outputs
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "The ID of the VPC for secure resource deployment within the network boundary"
  
  # No sensitive flag needed as VPC ID is a public identifier
}

output "vpc_cidr_block" {
  value       = aws_vpc.main.cidr_block
  description = "The CIDR block of the VPC for network segmentation and security group rules"
}

# Subnet Outputs for Multi-Tier Architecture
output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "List of IDs of public subnets for ALB and NAT gateway placement across availability zones"
}

output "private_subnet_ids" {
  value       = aws_subnet.private[*].id
  description = "List of IDs of private subnets for ECS tasks and Lambda functions with no direct internet access"
}

output "database_subnet_ids" {
  value       = aws_subnet.database[*].id
  description = "List of IDs of database subnets for RDS and ElastiCache placement with strict isolation"
}

# Additional Network Resource Outputs
output "nat_gateway_ids" {
  value       = aws_nat_gateway.main[*].id
  description = "List of NAT Gateway IDs for private subnet internet access"
}

output "internet_gateway_id" {
  value       = aws_internet_gateway.main.id
  description = "ID of the Internet Gateway for public subnet internet access"
}

# Route Table Outputs
output "public_route_table_id" {
  value       = aws_route_table.public.id
  description = "ID of the public route table for internet-facing resources"
}

output "private_route_table_ids" {
  value       = aws_route_table.private[*].id
  description = "List of private route table IDs for application tier resources"
}

output "database_route_table_id" {
  value       = aws_route_table.database.id
  description = "ID of the database route table for data tier resources"
}

# Network ACL Outputs
output "public_network_acl_id" {
  value       = aws_network_acl.public.id
  description = "ID of the public network ACL with HIPAA-compliant rules"
}

# VPC Flow Log Outputs
output "vpc_flow_log_group_name" {
  value       = aws_cloudwatch_log_group.flow_logs.name
  description = "Name of the CloudWatch Log Group for VPC Flow Logs (HIPAA audit requirement)"
}

output "vpc_flow_log_role_arn" {
  value       = aws_iam_role.flow_logs.arn
  description = "ARN of the IAM role used for VPC Flow Logs"
}

# Metadata Outputs
output "network_metadata" {
  value = {
    environment            = var.environment
    availability_zones    = var.availability_zones
    enable_nat_gateway    = var.enable_nat_gateway
    single_nat_gateway    = var.single_nat_gateway
    hipaa_compliant      = true
  }
  description = "Metadata about the network configuration including HIPAA compliance status"
}