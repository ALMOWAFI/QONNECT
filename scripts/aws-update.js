import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";
import { SSMClient, SendCommandCommand, GetCommandInvocationCommand } from "@aws-sdk/client-ssm";

const ec2 = new EC2Client({ region: "us-east-1" });
const ssm = new SSMClient({ region: "us-east-1" });

async function updateInstance() {
  try {
    const publicIp = "18.212.208.155";
    console.log(`🔍 Searching for instance with IP: ${publicIp}`);
    
    const desc = await ec2.send(new DescribeInstancesCommand({
      Filters: [{ Name: "ip-address", Values: [publicIp] }]
    }));

    if (!desc.Reservations || desc.Reservations.length === 0 || desc.Reservations[0].Instances.length === 0) {
      console.log("❌ Could not find an instance with that IP in us-east-1.");
      return;
    }

    const instanceId = desc.Reservations[0].Instances[0].InstanceId;
    console.log(`✅ Found Instance ID: ${instanceId}`);

    const script = `
      #!/bin/bash
      cd /home/ubuntu/QONNECT || cd /home/ec2-user/QONNECT || exit 1
      echo "Pulling latest code..."
      sudo git pull origin main
      
      echo "Stopping old container..."
      sudo docker stop qonnect-live || true
      sudo docker rm qonnect-live || true
      
      echo "Rebuilding image..."
      sudo docker build -t qonnect-brand .
      
      echo "Starting new container..."
      sudo docker run -d --name qonnect-live -p 80:3000 -p 3000:3000 --restart always qonnect-brand
      
      echo "Update Complete!"
    `;

    console.log("🚀 Sending update command via AWS Systems Manager (SSM)...");
    
    const sendRes = await ssm.send(new SendCommandCommand({
      InstanceIds: [instanceId],
      DocumentName: "AWS-RunShellScript",
      Parameters: { commands: [script] }
    }));

    const commandId = sendRes.Command.CommandId;
    console.log(`✅ Command sent! Command ID: ${commandId}`);
    console.log("Waiting for completion...");

    // Wait a bit
    await new Promise(res => setTimeout(res, 5000));
    
    try {
      const getRes = await ssm.send(new GetCommandInvocationCommand({
        CommandId: commandId,
        InstanceId: instanceId
      }));
      console.log(`Status: ${getRes.Status}`);
      if (getRes.StandardOutputContent) console.log(`Output: ${getRes.StandardOutputContent}`);
      if (getRes.StandardErrorContent) console.log(`Error: ${getRes.StandardErrorContent}`);
    } catch (e) {
      console.log("Status check pending (takes a bit to finish). The update is running in the background!");
    }

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

updateInstance();
