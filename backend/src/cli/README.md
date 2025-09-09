# RepairCoin Admin CLI

A command-line interface for managing RepairCoin administrators.

## Installation

From the backend directory:

```bash
npm install
```

## Usage

### Run the CLI

You can run the admin CLI in several ways:

```bash
# Using npm script
npm run admin

# Direct execution
./bin/repaircoin-admin

# With ts-node
ts-node src/cli/admin.ts
```

### Available Commands

#### List Administrators

```bash
npm run admin list
# or
npm run admin:list

# Include inactive admins
npm run admin list --all
```

#### Add New Administrator

```bash
npm run admin add
# or
npm run admin:add

# With options
npm run admin add --wallet 0x123... --name "John Doe" --email john@example.com
npm run admin add --super  # Grant super admin privileges
```

#### Update Administrator

```bash
npm run admin update 0x123...

# Update specific fields
npm run admin update 0x123... --name "New Name"
npm run admin update 0x123... --permissions manage_customers manage_shops
npm run admin update 0x123... --activate
npm run admin update 0x123... --deactivate
```

#### Remove Administrator

```bash
npm run admin remove 0x123...

# Skip confirmation
npm run admin remove 0x123... --force
```

#### Check Admin Status

```bash
npm run admin check 0x123...
# or
npm run admin:check 0x123...
```

#### Interactive Mode

Run the CLI in interactive mode with menu navigation:

```bash
npm run admin interactive
# or
npm run admin i
```

### Permissions

Available permissions:
- `all` - Full system access
- `manage_customers` - Create, update, suspend customers
- `manage_shops` - Approve shops, manage shop settings
- `manage_admins` - Create and manage other administrators
- `view_reports` - Access to analytics and reports
- `mint_tokens` - Mint tokens to addresses
- `manage_contract` - Pause/unpause smart contract
- `manage_treasury` - Manage treasury operations

### Examples

#### Create a new admin with specific permissions:

```bash
npm run admin add \
  --wallet 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e \
  --name "Alice Smith" \
  --email alice@repaircoin.com \
  --permissions manage_customers manage_shops view_reports
```

#### Update an admin's permissions:

```bash
npm run admin update 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e \
  --permissions all
```

#### Deactivate an admin:

```bash
npm run admin update 0x742d35Cc6634C0532925a3b844Bc9e7595f2bD7e \
  --deactivate
```

### Security Notes

1. **Super Admin**: The first address in `ADMIN_ADDRESSES` environment variable is considered the primary super admin and cannot be removed via CLI.

2. **Database Storage**: All admins are stored in the database with the super admin being auto-migrated from environment variables if not present.

3. **Permission Checks**: Only users with appropriate permissions can perform admin management operations.

### Environment Variables

Required environment variables:
- `ADMIN_ADDRESSES` - Comma-separated list of admin wallet addresses (first is super admin)
- `DATABASE_URL` or individual DB connection params
- Other standard RepairCoin backend environment variables

### Troubleshooting

If you encounter connection issues:
1. Ensure the database is running
2. Check that `.env` file is properly configured
3. Verify that you're in the `backend` directory when running commands

For permission errors:
1. Ensure your wallet address is configured as super admin
2. Check that the admin exists and is active in the database