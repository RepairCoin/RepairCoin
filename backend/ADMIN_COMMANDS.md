# 🔧 Admin Role Management Commands

## Overview

The RepairCoin backend provides CLI tools for safely managing admin role promotions and detecting role conflicts. These commands help prevent security issues when adding existing customers or shops to the `ADMIN_ADDRESSES` environment variable.

## Available Commands

### 🔍 **Check for Role Conflicts**
```bash
npm run admin:check-conflicts
```
**Purpose**: Scan all addresses in `ADMIN_ADDRESSES` for existing customer/shop roles
**Output**: Detailed report showing conflicts, valid addresses, and invalid formats
**Use when**: 
- Before deploying with new admin addresses
- Regular security audits
- Troubleshooting authentication issues

---

### 🚀 **Promote Address to Admin**
```bash
npm run admin:promote <wallet_address> --action <resolution_action> [options]
```

**Parameters:**
- `<wallet_address>`: Ethereum address to promote (e.g., `0x123...abc`)
- `--action <resolution_action>`: How to handle existing role conflicts
- `--reason <reason>`: Reason for promotion (for audit logs)
- `--dry-run`: Preview changes without applying them

**Resolution Actions:**
| Action | Description | Security | Use Case |
|--------|-------------|----------|----------|
| `deactivate` | Disable existing customer/shop role | ✅ **Recommended** | Clean role transition |
| `preserve` | Keep both roles active | ⚠️ Caution | Special dual-role needs |
| `force` | Ignore conflicts entirely | ❌ **Not recommended** | Emergency override only |

**Examples:**
```bash
# Recommended: Deactivate existing role and promote to admin
npm run admin:promote 0x1234567890123456789012345678901234567890 --action deactivate --reason "Shop owner promoted to platform admin"

# Test changes first (dry run)
npm run admin:promote 0x1234567890123456789012345678901234567890 --action deactivate --dry-run

# Emergency override (use with caution)
npm run admin:promote 0x1234567890123456789012345678901234567890 --action force --reason "Emergency admin access needed"
```

---

### 📚 **View Role Change History**
```bash
npm run admin:history <wallet_address>
```
**Purpose**: Display audit trail of role changes for a specific address
**Output**: Chronological list of promotions, demotions, and role conflicts
**Use when**: 
- Compliance audits
- Investigating role issues
- Tracking administrative changes

**Example:**
```bash
npm run admin:history 0x1234567890123456789012345678901234567890
```

---

### ❓ **Show Help**
```bash
npm run admin:help
```
**Purpose**: Display detailed usage instructions and examples
**Output**: Complete CLI reference with all options

## Security Features

### 🛡️ **Automatic Conflict Detection**
- **Startup Validation**: Application checks for conflicts on startup
- **Authentication Blocking**: Prevents auto-admin creation when conflicts exist
- **Clear Error Messages**: Detailed guidance for resolution

### 📋 **Audit Logging**
- All role changes logged in `admin_role_audit` table
- Includes: timestamp, previous role, action taken, reason, promoted by
- Permanent audit trail for compliance

### 🚦 **Environment Controls**
- `ADMIN_ADDRESSES`: Comma-separated admin wallet addresses
- `ADMIN_SKIP_CONFLICT_CHECK=true`: Bypass validation (emergency use only)

## Common Scenarios

### 📋 **Scenario 1: Shop Owner Becomes Platform Admin**
```bash
# 1. Check if address has conflicts
npm run admin:check-conflicts

# 2. Test the promotion
npm run admin:promote 0x123...abc --action deactivate --reason "Shop owner promotion" --dry-run

# 3. Apply the promotion
npm run admin:promote 0x123...abc --action deactivate --reason "Shop owner promotion"

# 4. Verify the change
npm run admin:history 0x123...abc
```

### 📋 **Scenario 2: Customer Needs Admin Access**
```bash
# Promote customer to admin (deactivates customer role)
npm run admin:promote 0x456...def --action deactivate --reason "Customer support team member"
```

### 📋 **Scenario 3: Emergency Admin Access**
```bash
# Force promotion despite conflicts (use sparingly)
npm run admin:promote 0x789...ghi --action force --reason "Emergency platform maintenance"
```

## Error Resolution

### ❌ **Application Won't Start - Role Conflicts Detected**
```bash
# 1. Check what conflicts exist
npm run admin:check-conflicts

# 2. Resolve each conflict
npm run admin:promote <address> --action deactivate --reason "Startup conflict resolution"

# 3. Or temporarily bypass (not recommended)
ADMIN_SKIP_CONFLICT_CHECK=true npm start
```

### ❌ **"Admin auto-creation blocked due to role conflict"**
```bash
# Use CLI to safely promote the address
npm run admin:promote <address> --action deactivate --reason "Resolve auto-creation conflict"
```

## Best Practices

1. **Always check for conflicts first**: `npm run admin:check-conflicts`
2. **Use dry-run to test changes**: `--dry-run` flag
3. **Prefer `deactivate` action**: Cleanest role separation
4. **Document promotions**: Always use `--reason` parameter
5. **Regular audits**: Check role history periodically
6. **Avoid `force` action**: Only for true emergencies

## Troubleshooting

- **TypeScript errors**: Run `npm run typecheck` to verify code
- **Database connection issues**: Check `DATABASE_URL` environment variable
- **Permission errors**: Ensure wallet has necessary permissions in database
- **Invalid address format**: Must be valid Ethereum address (0x + 40 hex chars)

## Support

For additional help or to report issues with admin role management:
1. Check application logs for detailed error messages
2. Run `npm run admin:help` for CLI reference
3. Review audit logs with `npm run admin:history <address>`