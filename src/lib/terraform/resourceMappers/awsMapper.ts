import type { ResourceMapping } from '@/lib/terraform/terraformTypes'

const AWS_RESOURCE_MAP: Record<string, Partial<ResourceMapping>> = {
  // Compute (10 resources)
  'aws_instance': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  },
  'aws_lambda_function': {
    deviceType: 'function-apps',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Aws-Lambda.svg',
  },
  'aws_ecs_cluster': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ecs.svg',
  },
  'aws_eks_cluster': {
    deviceType: 'kubernetes-services',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Eks-Cloud.svg',
  },
  'aws_batch_compute_environment': {
    deviceType: 'batch-accounts',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Aws-Batch.svg',
  },
  'aws_ec2_spot_instance': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2-Spot-Instance.svg',
  },
  'aws_ec2_ami': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2-Ami.svg',
  },
  'aws_apprunner_service': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Aws-App-Runner.svg',
  },
  'aws_elastic_beanstalk_application': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Aws-Elastic-Beanstalk-Application.svg',
  },
  'aws_lightsail_instance': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Lightsail.svg',
  },
  
  // Networking (10 resources)
  'aws_vpc': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Virtual-Private-Cloud-Vpc.svg',
  },
  'aws_subnet': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Virtual-Private-Cloud-Vpc.svg',
  },
  'aws_security_group': {
    deviceType: 'network-security-groups',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Identity-And-Access-Management.svg',
  },
  'aws_lb': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Elastic-Load-Balancing.svg',
  },
  'aws_alb': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Elastic-Load-Balancing.svg',
  },
  'aws_elb': {
    deviceType: 'load-balancers',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Elastic-Load-Balancing.svg',
  },
  'aws_internet_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Internet-Gateway.svg',
  },
  'aws_nat_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Nat-Gateway.svg',
  },
  'aws_vpc_endpoint': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Endpoints.svg',
  },
  'aws_vpn_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Vpn-Gateway.svg',
  },
  
  // Storage (5 resources)
  'aws_s3_bucket': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Simple-Storage-Service.svg',
  },
  'aws_ebs_volume': {
    deviceType: 'disk-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Elastic-Block-Store.svg',
  },
  'aws_efs_file_system': {
    deviceType: 'file-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Efs.svg',
  },
  'aws_glacier_vault': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Simple-Storage-Service-Glacier.svg',
  },
  'aws_fsx_lustre_file_system': {
    deviceType: 'file-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Fsx-For-Lustre.svg',
  },
  
  // Databases (5 resources)
  'aws_db_instance': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Rds.svg',
  },
  'aws_dynamodb_table': {
    deviceType: 'cosmos-db',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Dynamodb.svg',
  },
  'aws_rds_cluster': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Aurora.svg',
  },
  'aws_elasticache_cluster': {
    deviceType: 'cache-redis',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Elasticache.svg',
  },
  'aws_redshift_cluster': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Redshift.svg',
  },
  
  // Additional Networking resources
  'aws_route_table': {
    deviceType: 'route-tables',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Router.svg',
  },
  'aws_route': {
    deviceType: 'route-tables',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Router.svg',
  },
  'aws_network_acl': {
    deviceType: 'firewalls',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Network-Access-Control-List.svg',
  },
  'aws_cloudfront_distribution': {
    deviceType: 'cdn',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Cloudfront.svg',
  },
  'aws_transit_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Aws-Transit-Gateway.svg',
  },
  'aws_api_gateway_rest_api': {
    deviceType: 'api-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Api-Gateway.svg',
  },
  'aws_api_gateway_vpc_link': {
    deviceType: 'api-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Api-Gateway-Endpoint.svg',
  },
  'aws_vpc_peering_connection': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Peering-Connection.svg',
  },
  'aws_customer_gateway': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Customer-Gateway.svg',
  },
  'aws_vpn_connection': {
    deviceType: 'virtual-network-gateways',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Amazon-Vpc-Vpn-Connection.svg',
  },
  'aws_app_mesh': {
    deviceType: 'virtual-networks',
    category: 'Networking',
    iconPath: 'src/Icons/Aws/Networking/Aws-App-Mesh.svg',
  },
  'aws_cloud_waf': {
    deviceType: 'firewalls',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Waf.svg',
  },
  'aws_waf_web_acl': {
    deviceType: 'firewalls',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Waf.svg',
  },
  'aws_waf_rule': {
    deviceType: 'firewalls',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Waf-Rule.svg',
  },
  
  // Security resources
  'aws_secretsmanager_secret': {
    deviceType: 'key-vaults',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Secrets-Manager.svg',
  },
  'aws_iam_role': {
    deviceType: 'identity-access-management',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Identity-Access-Management-Role.svg',
  },
  'aws_iam_user': {
    deviceType: 'identity-access-management',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Identity-And-Access-Management.svg',
  },
  'aws_iam_policy': {
    deviceType: 'identity-access-management',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Identity-Access-Management-Permissions.svg',
  },
  'aws_shield_protection': {
    deviceType: 'ddos-protection',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Shield.svg',
  },
  'aws_guardduty_detector': {
    deviceType: 'security-monitoring',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Amazon-Guardduty.svg',
  },
  'aws_security_hub_account': {
    deviceType: 'security-monitoring',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Aws-Security-Hub.svg',
  },
  'aws_inspector_assessment_target': {
    deviceType: 'security-monitoring',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Amazon-Inspector.svg',
  },
  'aws_macie2_account': {
    deviceType: 'security-monitoring',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Amazon-Macie.svg',
  },
  'aws_cognito_user_pool': {
    deviceType: 'identity-providers',
    category: 'Security',
    iconPath: 'src/Icons/Aws/Security-Identity/Amazon-Cognito.svg',
  },
  
  // Application Integration
  'aws_sns_topic': {
    deviceType: 'messaging',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Eventbridge.svg',
  },
  'aws_sqs_queue': {
    deviceType: 'messaging',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Eventbridge.svg',
  },
  'aws_eventbridge_rule': {
    deviceType: 'event-processing',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Eventbridge-Rule.svg',
  },
  'aws_eventbridge_bus': {
    deviceType: 'event-processing',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Eventbridge-Default-Event-Bus.svg',
  },
  'aws_stepfunctions_state_machine': {
    deviceType: 'workflows',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Aws-Step-Functions.svg',
  },
  'aws_mq_broker': {
    deviceType: 'messaging',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Mq-Broker.svg',
  },
  'aws_msk_cluster': {
    deviceType: 'messaging',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Amazon-Managed-Streaming-For-Apache-Kafka.svg',
  },
  'aws_appsync_graphql_api': {
    deviceType: 'api-gateways',
    category: 'Integration',
    iconPath: 'src/Icons/Aws/Application-Integration/Aws-Appsync.svg',
  },
  
  // Additional Compute resources
  'aws_ecr_repository': {
    deviceType: 'container-registries',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  },
  'aws_ecs_service': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ecs.svg',
  },
  'aws_ecs_task_definition': {
    deviceType: 'container-instances',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ecs.svg',
  },
  'aws_autoscaling_group': {
    deviceType: 'vm-scale-sets',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  },
  'aws_launch_configuration': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  },
  'aws_launch_template': {
    deviceType: 'virtual-machine',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Amazon-Ec2.svg',
  },
  'aws_elastic_beanstalk_environment': {
    deviceType: 'app-services',
    category: 'Compute',
    iconPath: 'src/Icons/Aws/Compute/Aws-Elastic-Beanstalk-Application.svg',
  },
  
  // Additional Storage resources
  'aws_s3_bucket_policy': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Simple-Storage-Service.svg',
  },
  'aws_s3_bucket_public_access_block': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Simple-Storage-Service.svg',
  },
  'aws_s3_bucket_notification': {
    deviceType: 'storage-accounts',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Simple-Storage-Service.svg',
  },
  'aws_fsx_windows_file_system': {
    deviceType: 'file-storage',
    category: 'Storage',
    iconPath: 'src/Icons/Aws/Storage/Amazon-Fsx-For-Lustre.svg',
  },
  
  // Additional Database resources
  'aws_db_subnet_group': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Rds.svg',
  },
  'aws_db_parameter_group': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Rds.svg',
  },
  'aws_db_option_group': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Rds.svg',
  },
  'aws_rds_instance': {
    deviceType: 'sql-database',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Rds.svg',
  },
  'aws_dynamodb_table_item': {
    deviceType: 'cosmos-db',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Dynamodb.svg',
  },
  'aws_elasticache_replication_group': {
    deviceType: 'cache-redis',
    category: 'Databases',
    iconPath: 'src/Icons/Aws/Databases/Amazon-Elasticache.svg',
  },
}

export class AWSMapper {
  /**
   * Map AWS resource to device type
   * This now uses the intelligent device type matcher when available
   */
  async mapResourceAsync(type: string, attributes: any): Promise<ResourceMapping> {
    const mapping = AWS_RESOURCE_MAP[type]
    const name = this.extractName(attributes, type)

    // If we have a static mapping, use device type matcher to find best match
    if (mapping && typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const matchResult = await (window as any).electronAPI.findDeviceTypeMatch({
          deviceType: mapping.deviceType,
          category: mapping.category,
          resourceType: type,
          provider: 'aws',
          iconPath: mapping.iconPath
        })

        if (matchResult && matchResult.matched) {
          return {
            deviceType: matchResult.deviceType,
            deviceSubtype: matchResult.deviceSubtype || type,
            iconPath: matchResult.iconPath,
            category: mapping.category!,
            defaultName: name,
          }
        }
      } catch (error) {
        console.warn('[AWSMapper] Failed to match device type, using static mapping:', error)
      }
    }

    // Fallback to static mapping or default
    if (mapping) {
      return {
        deviceType: mapping.deviceType!,
        deviceSubtype: type,
        iconPath: mapping.iconPath!,
        category: mapping.category!,
        defaultName: name,
      }
    }

    return this.getDefaultMapping(type, attributes)
  }

  /**
   * Synchronous version for backwards compatibility
   * Will be deprecated once all callers use async version
   */
  mapResource(type: string, attributes: any): ResourceMapping {
    const mapping = AWS_RESOURCE_MAP[type]

    if (!mapping) {
      return this.getDefaultMapping(type, attributes)
    }

    return {
      deviceType: mapping.deviceType!,
      deviceSubtype: type,
      iconPath: mapping.iconPath!,
      category: mapping.category!,
      defaultName: this.extractName(attributes, type),
    }
  }

  private extractName(attributes: any, type: string): string {
    if (attributes?.tags?.Name) return attributes.tags.Name
    if (attributes?.name) return attributes.name
    return type.replace('aws_', '').replace(/_/g, '-')
  }

  private getDefaultMapping(type: string, attributes: any): ResourceMapping {
    return {
      deviceType: 'virtual-machine',
      deviceSubtype: type,
      iconPath: 'src/Icons/Other/Miscellaneous/Generic-Resource.svg',
      category: 'Other',
      defaultName: this.extractName(attributes, type),
    }
  }
}

