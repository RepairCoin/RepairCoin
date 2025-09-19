# RepairCoin Deployment Guide

This guide explains how to set up automatic deployment to Digital Ocean App Platform using GitHub Actions.

## Prerequisites

1. Digital Ocean account with App Platform enabled
2. Digital Ocean app already created for the backend
3. GitHub repository with admin access to configure secrets

## Setting Up Automatic Deployment

### Step 1: Get Your Digital Ocean Access Token

1. Log in to your Digital Ocean account
2. Go to **API** → **Tokens/Keys** in the left sidebar
3. Click **Generate New Token**
4. Name it "GitHub Actions Deployment" or similar
5. Select **Read & Write** scopes
6. Copy the token immediately (you won't see it again)

### Step 2: Get Your App ID

1. Go to your Digital Ocean App Platform dashboard
2. Click on your RepairCoin backend app
3. Look at the URL - it should be something like:
   ```
   https://cloud.digitalocean.com/apps/12345678-90ab-cdef-1234-567890abcdef
   ```
4. The App ID is the UUID part: `12345678-90ab-cdef-1234-567890abcdef`

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Add the following secrets:

   **DIGITALOCEAN_ACCESS_TOKEN**
   - Click "New repository secret"
   - Name: `DIGITALOCEAN_ACCESS_TOKEN`
   - Value: The token you copied from Digital Ocean
   
   **DIGITALOCEAN_APP_ID**
   - Click "New repository secret"
   - Name: `DIGITALOCEAN_APP_ID`
   - Value: Your backend app's UUID from the URL
   
   **DIGITALOCEAN_FRONTEND_APP_ID** (if deploying frontend)
   - Click "New repository secret"
   - Name: `DIGITALOCEAN_FRONTEND_APP_ID`
   - Value: Your frontend app's UUID
   
   **NEXT_PUBLIC_API_URL** (optional)
   - Click "New repository secret"
   - Name: `NEXT_PUBLIC_API_URL`
   - Value: Your backend API URL (e.g., `https://your-backend.ondigitalocean.app/api`)
   - If not set, defaults to staging URL in workflow

### Step 4: Verify Your App Settings

Ensure your Digital Ocean app is configured correctly:

1. **Build Command**: Should be set to `npm run build` or handled by the Dockerfile
2. **Run Command**: Should be `npm start` or `node dist/app.js`
3. **Environment Variables**: All required env vars should be configured in the app settings
4. **Health Check Path**: Should be `/api/health`

## How Automatic Deployment Works

### Trigger Conditions

The deployment will automatically trigger when:

1. **Code is pushed to the `main` branch** AND
2. **Changes are detected in the `backend/` directory** OR
3. **The workflow file itself is modified**

You can also manually trigger a deployment:
1. Go to **Actions** tab in GitHub
2. Select "Deploy Backend to Digital Ocean"
3. Click "Run workflow"
4. Optionally check "Force deployment" to deploy even without backend changes

### Deployment Process

1. **Build Phase**
   - Checks out the latest code
   - Sets up Node.js 18
   - Runs `npm ci` to install dependencies
   - Runs `npm run build` to compile TypeScript

2. **Deploy Phase**
   - Uses Digital Ocean CLI to create a new deployment
   - Forces a rebuild to ensure fresh container
   - Waits for deployment to complete

3. **Monitor Phase**
   - Polls deployment status every 10 seconds
   - Maximum wait time: 10 minutes
   - Fails fast if deployment errors occur

4. **Verify Phase**
   - Waits 30 seconds for app to stabilize
   - Checks `/api/health` endpoint
   - Reports deployment summary

## Monitoring Deployments

### GitHub Actions UI

1. Go to the **Actions** tab in your repository
2. Click on a workflow run to see detailed logs
3. Each step shows its status and output

### Digital Ocean Dashboard

1. Go to your app in Digital Ocean App Platform
2. Click on **Activity** tab to see deployment history
3. Click on any deployment for detailed logs

## Troubleshooting

### Common Issues

1. **"Authentication required" error**
   - Verify your `DIGITALOCEAN_ACCESS_TOKEN` is correct
   - Ensure the token has read/write permissions

2. **"App not found" error**
   - Double-check your `DIGITALOCEAN_APP_ID`
   - Ensure the app exists and is accessible

3. **Build failures**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles locally with `npm run build`

4. **Health check failures**
   - Verify `/api/health` endpoint exists and returns 200
   - Check app logs in Digital Ocean for startup errors

### Debugging Steps

1. **Check GitHub Action logs**
   ```bash
   # Each step provides detailed output
   # Look for error messages in red
   ```

2. **Check Digital Ocean logs**
   ```bash
   # In your app dashboard:
   # Runtime Logs → View logs
   ```

3. **Test locally**
   ```bash
   cd backend
   npm run build
   npm start
   # Verify it starts without errors
   ```

## Best Practices

1. **Test before pushing to main**
   - Use feature branches
   - Test builds locally
   - Merge only after verification

2. **Monitor deployments**
   - Watch the GitHub Actions tab after pushing
   - Check Digital Ocean activity logs
   - Verify API endpoints are working

3. **Environment variables**
   - Keep production secrets in Digital Ocean app settings
   - Never commit sensitive data to the repository
   - Use different values for staging vs production

4. **Database migrations**
   - Run migrations separately, not during deployment
   - Test migrations on a backup first
   - Have a rollback plan

## Manual Deployment (Fallback)

If automatic deployment fails, you can deploy manually:

```bash
# Install Digital Ocean CLI
brew install doctl  # macOS
# or follow instructions at https://docs.digitalocean.com/reference/doctl/how-to/install/

# Authenticate
doctl auth init

# List your apps
doctl apps list

# Create deployment
doctl apps create-deployment YOUR_APP_ID

# Monitor deployment
doctl apps get YOUR_APP_ID
```

## Next Steps

1. Make a small change to the backend code
2. Commit and push to `main` branch
3. Watch the deployment in GitHub Actions
4. Verify the API is working with the new changes

## Support

- Digital Ocean App Platform docs: https://docs.digitalocean.com/products/app-platform/
- GitHub Actions docs: https://docs.github.com/en/actions
- RepairCoin backend issues: Check error logs in Digital Ocean dashboard