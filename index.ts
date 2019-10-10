import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

import * as awsSdk from "aws-sdk";

const stack = pulumi.getStack();

async function main() {
  const cluster = new awsx.ecs.Cluster("fargate", {
    name: `test-fargate-cluser-${stack}`
  });

  const CommandsImage = awsx.ecs.Image.fromPath("commands-image", ".");
  const fargateTaskDefinition = new awsx.ecs.FargateTaskDefinition(
    "fargate-commands",
    {
      container: {
        image: CommandsImage,
        environment: [],
        command: ["node", "./command1.js"]
      }
    }
  );

  const fargateTask = new FargateTask("database-migrations", {
    cluster,
    taskDefinition: fargateTaskDefinition
  });

  return {};
}

export interface FargateTaskResourceInputs {
  awsRegion: pulumi.Input<string>;
  clusterArn: pulumi.Input<string>;
  taskDefinitionArn: pulumi.Input<string>;
  subnetIds: pulumi.Input<string>[];
  securityGroupIds: pulumi.Input<string>[];
}
interface FargateTaskInputs {
  awsRegion: string;
  clusterArn: string;
  taskDefinitionArn: string;
  subnetIds: string[];
  securityGroupIds: string[];
}

const fargateTaskService: pulumi.dynamic.ResourceProvider = {
  async create(inputs: FargateTaskInputs) {
    const ecs = new awsSdk.ECS({ region: "ap-southeast-2" });

    const result = await ecs
      .runTask({
        cluster: inputs.clusterArn,
        taskDefinition: inputs.taskDefinitionArn,
        launchType: "FARGATE",

        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: inputs.subnetIds,
            securityGroups: inputs.securityGroupIds,
            assignPublicIp: "ENABLED"
          }
        }
      })
      .promise();

    // Not sure what to make id for now =/
    return {
      id: "fargate-task",
      tasks: (result.tasks || []).map(task => task.taskArn),
      failures: result.failures
    };
  },

  async update(
    _id,
    _oldInputs: FargateTaskInputs,
    newInputs: FargateTaskInputs
  ) {
    return {
      outs: await this.create(newInputs)
    };
  }
};

export class FargateTask extends pulumi.dynamic.Resource {
  constructor(
    name: string,
    args: {
      cluster: awsx.ecs.Cluster;
      taskDefinition: awsx.ecs.FargateTaskDefinition;
    },
    opts?: pulumi.CustomResourceOptions
  ) {
    const awsConfig = new pulumi.Config("aws");

    const securityGroupIds = args.cluster.securityGroups.map(g => g.id);
    const subnetIds = args.cluster.vpc.getSubnetIds("public");

    const resourceArgs: FargateTaskResourceInputs = {
      clusterArn: args.cluster.cluster.arn,
      taskDefinitionArn: args.taskDefinition.taskDefinition.arn,
      awsRegion: awsConfig.require("region"),
      subnetIds,
      securityGroupIds
    };
    super(fargateTaskService, name, resourceArgs, opts);
  }
}

module.exports = main();
