const axios = require("axios");
const { stripIndents } = require("common-tags");
const core = require('@actions/core');
const github = require('@actions/github');
const context = github.context;

const zeitToken = core.getInput('zeit-token');
const zeitTeamId = core.getInput('zeit-team-id');
const githubToken = core.getInput('github-token');

const zeitAPIClient = axios.create({
  baseURL: "https://api.zeit.co",
  headers: {
    Authorization: `Bearer ${zeitToken}`
  },
  params: {
    teamId: zeitTeamId || undefined
  }
});

const octokit = new github.GitHub(githubToken);

async function run() {
  await octokit.issues.listComments({
    ...context.repo,
    issue_number: context.payload.pull_request.number
  })

  const zeitPreviewURLComment = comments.find(comment =>
    comment.body.startsWith("Deploy preview for _website_ ready!")
  );

  let deploymentUrl;
  let deploymentCommit;

  const {
    data: {
      deployments: [commitDeployment]
    }
  } = await zeitAPIClient.get("/v4/now/deployments", {
    params: {
      "meta-commit": process.env.GITHUB_SHA
    }
  });

  if (commitDeployment) {
    deploymentUrl = commitDeployment.url;
    deploymentCommit = commitDeployment.meta.commit;
  } else {
    const {
      data: {
        deployments: [lastBranchDeployment]
      }
    } = await zeitAPIClient.get("/v4/now/deployments", {
      params: {
        "meta-branch": process.env.GITHUB_REF
      }
    });

    if (lastBranchDeployment) {
      deploymentUrl = lastBranchDeployment.url;
      deploymentCommit = lastBranchDeployment.meta.commit;
    } else {
      const {
        data: {
          deployments: [lastDeployment]
        }
      } = await zeitAPIClient.get("/v4/now/deployments", {
        params: {
          limit: 1
        }
      });

      if (lastDeployment) {
        deploymentUrl = lastDeployment.url;
        deploymentCommit = lastDeployment.meta.commit;
      }
    }
  }

  const commentBody = stripIndents`
    Deploy preview for _website_ ready!

    Built with commit ${deploymentCommit}

    https://${deploymentUrl}
  `;

  if (zeitPreviewURLComment) {
    await tools.github.issues.updateComment({
      ...tools.context.repo,
      comment_id: zeitPreviewURLComment.id,
      body: commentBody
    });
  } else {
    await tools.github.issues.createComment({
      ...tools.context.repo,
      issue_number: tools.context.payload.pull_request.number,
      body: commentBody
    });
  }
  core.setOutput('preview-url', `https://${deploymentUrl}`);
}


run().catch( error => {
  core.setFailed(error.message);
});

