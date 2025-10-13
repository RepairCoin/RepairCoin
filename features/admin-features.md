# RepairCoin Admin Features

## Overview
The RepairCoin Admin Dashboard provides comprehensive platform management capabilities for system administrators. This guide covers all available features for both technical and non-technical users.

---

## 🏠 Dashboard Overview

### **Analytics & Statistics**
- **Platform Overview**: Real-time metrics showing total customers, shops, transactions, and token supply
- **Revenue Tracking**: Monthly revenue from shop subscriptions and token sales
- **Growth Metrics**: Customer acquisition rates, shop onboarding progress, and platform adoption trends
- **Transaction Monitoring**: Live feed of all RCN transactions across the platform

### **Quick Actions**
- Create new admin accounts
- Review pending shop applications
- Monitor system health
- Access emergency controls

---

## 👥 Customer Management

### **Customer Analytics**
- **Customer Overview**: Total registered customers, active users, suspended accounts
- **Tier Distribution**: Breakdown of customers across Bronze, Silver, and Gold tiers
- **Earnings Analysis**: Customer earning patterns, average RCN earned per repair
- **Geographic Distribution**: Customer locations and regional activity
- **Referral Tracking**: Most successful referrers and referral conversion rates

### **User Flow: Viewing Customer Analytics**
```
1. Admin logs into dashboard
2. Clicks "Customers" tab
3. Dashboard loads with overview metrics
4. Admin can:
   → View tier distribution chart
   → Click on earnings analytics
   → Filter by date range
   → Export analytics data
   → Drill down into specific customer segments
5. System updates metrics in real-time
```

### **Customer Operations**
- **Search & Filter**: Find customers by wallet address, email, phone, or name
- **Account Management**: View customer profiles, transaction history, and tier status
- **Suspension Controls**: Suspend/unsuspend customer accounts with reason tracking
- **Balance Management**: View RCN balances, pending mints, and redemption history
- **Support Tools**: Handle customer issues and balance discrepancies

### **User Flow: Managing Customer Account**
```
1. Admin navigates to Customers tab
2. Uses search bar to find customer by:
   → Wallet address (0x...)
   → Email address
   → Phone number
   → Customer name
3. Clicks on customer from search results
4. Customer profile opens showing:
   → Personal information
   → Transaction history
   → Current tier status
   → RCN balance details
5. Admin can perform actions:
   → View detailed transaction history
   → Suspend/unsuspend account
   → Add internal notes
   → Manually adjust balance (if authorized)
   → Send customer notification
6. All actions are logged with admin ID and timestamp
```

### **User Flow: Customer Suspension Process**
```
1. Admin identifies customer needing suspension
2. Opens customer profile
3. Clicks "Suspend Account" button
4. System prompts for:
   → Suspension reason (dropdown + text)
   → Suspension duration (temporary/permanent)
   → Internal notes
5. Admin confirms suspension
6. System immediately:
   → Blocks customer from earning/redeeming tokens
   → Sends notification to customer (if enabled)
   → Logs action in audit trail
   → Updates customer status in database
7. Customer can submit unsuspension request through their app
```

### **Unsuspend Requests**
- **Request Queue**: Review customer-submitted unsuspension requests
- **Decision Tracking**: Approve or deny requests with detailed reasoning
- **Communication**: Send responses to customers regarding their requests
- **Audit Trail**: Complete history of suspension/unsuspension actions

### **User Flow: Processing Unsuspension Requests**
```
1. Admin receives notification of new unsuspension request
2. Navigates to "Unsuspend Requests" tab
3. Views queue of pending requests showing:
   → Customer name and wallet address
   → Original suspension reason
   → Request submission date
   → Customer's explanation/appeal
4. Admin clicks on specific request
5. Reviews detailed information:
   → Full suspension history
   → Customer's appeal text
   → Account activity before suspension
   → Previous unsuspension requests
6. Admin makes decision:
   → Approve: Customer immediately unsuspended
   → Deny: Request marked as denied
   → Request more info: Send message to customer
7. System sends automated notification to customer
8. Decision is logged in audit trail with reasoning
```

---

## 🏪 Shop Management

### **Shop Applications**
- **Application Review**: Detailed review interface for new shop applications
- **Document Verification**: Check business licenses, tax IDs, and registration documents
- **Contact Verification**: Validate shop contact information and business details
- **Approval Workflow**: Approve, reject, or request additional information
- **Notification System**: Automated emails to shops regarding application status

### **User Flow: Reviewing Shop Applications**
```
1. Admin receives notification of new shop application
2. Navigates to "Shop Applications" tab
3. Views list of pending applications with status indicators
4. Clicks on application to review
5. Reviews application details:
   → Business information (name, address, contact)
   → Uploaded documents (license, tax ID, registration)
   → Owner/manager contact information
   → Services offered and specializations
6. Performs verification checks:
   → Validates business license authenticity
   → Confirms tax ID format and status
   → Verifies contact information
   → Checks for duplicate applications
7. Makes decision:
   → Approve: Shop gains immediate platform access
   → Reject: Application denied with reason
   → Request Info: Send message requesting additional documents
8. System automatically:
   → Sends notification email to shop
   → Updates application status
   → Logs decision in audit trail
   → Triggers subscription setup (if approved)
```

### **Active Shop Management**
- **Shop Directory**: Complete list of verified shops with status indicators
- **Subscription Monitoring**: Track shop subscription payments and renewal dates
- **Performance Metrics**: Shop transaction volumes, customer ratings, and activity levels
- **Compliance Monitoring**: Ensure shops meet platform requirements and guidelines
- **Communication Tools**: Direct messaging with shop owners for support and updates

### **Shop Analytics**
- **Revenue Analysis**: Track shop performance and token purchase patterns
- **Customer Engagement**: Monitor how customers interact with different shops
- **Geographic Coverage**: Map view of shop locations and service areas
- **Tier Distribution**: Analysis of shop RCG holdings and tier status

---

## 💰 Financial Management

### **Treasury Operations**
- **RCN Treasury**: Monitor admin RCN balance and token distribution
- **RCG Holdings**: Track governance token reserves and staking rewards
- **Revenue Streams**: Detailed breakdown of subscription revenue and token sales
- **Expense Tracking**: Platform operational costs and token minting expenses

### **Token Management**
- **Minting Controls**: Manual RCN minting for special circumstances
- **Supply Monitoring**: Track total token supply and circulation metrics
- **Burn Operations**: Record token burns from redemptions and platform fees
- **Price Analytics**: Monitor RCN/RCG pricing and market dynamics

### **Financial Reporting**
- **Monthly Reports**: Automated financial summaries and trend analysis
- **Tax Preparation**: Export financial data for accounting and tax purposes
- **Audit Support**: Comprehensive transaction logs and financial records
- **Compliance Monitoring**: Ensure platform meets financial regulations

---

## 🛡️ System Administration

### **Blockchain Management**
- **Contract Monitoring**: Real-time status of RCN and RCG smart contracts
- **Network Health**: Base Sepolia network connectivity and performance
- **Contract Controls**: Emergency pause/unpause functionality for security
- **Transaction Monitoring**: Track all blockchain transactions and gas usage

### **Security & Access Control**
- **Admin Account Management**: Create, modify, and revoke admin access
- **Permission Levels**: Assign specific roles (admin vs super_admin)
- **Activity Logging**: Complete audit trail of all admin actions
- **Security Alerts**: Automated notifications for suspicious activities

### **System Health Monitoring**
- **Live Status Dashboard**: Real-time system health indicators
- **Database Performance**: Connection pool stats and query performance
- **API Monitoring**: Response times and error rates across all endpoints
- **Alert Management**: Configurable alerts for system issues

---

## 📊 Promo Code Management

### **Campaign Creation**
- **Code Generation**: Create promotional codes with custom parameters
- **Discount Configuration**: Set percentage or fixed amount discounts
- **Usage Limits**: Control maximum uses per code and per customer
- **Validity Periods**: Set start and end dates for promotional campaigns
- **Shop Targeting**: Create shop-specific or platform-wide promotions

### **User Flow: Creating Promo Code Campaign**
```
1. Admin navigates to "Promo Codes" tab
2. Clicks "Create New Campaign" button
3. Fills out campaign details:
   → Campaign name and description
   → Promo code (auto-generated or custom)
   → Discount type (percentage or fixed amount)
   → Discount value
4. Sets usage parameters:
   → Maximum total uses
   → Maximum uses per customer
   → Start date and time
   → End date and time
5. Chooses targeting:
   → All shops (platform-wide)
   → Specific shops (select from list)
   → Shop tiers (Standard/Premium/Elite)
6. Configures additional settings:
   → Minimum purchase amount
   → Customer eligibility criteria
   → Auto-deactivation rules
7. Reviews campaign summary
8. Clicks "Create Campaign"
9. System validates settings and creates campaign
10. Campaign goes live automatically at start date
11. Admin receives confirmation with tracking dashboard link
```

### **Campaign Analytics**
- **Usage Tracking**: Monitor how many times each code has been used
- **Revenue Impact**: Calculate revenue generated from promotional campaigns
- **Customer Acquisition**: Track new customers acquired through promos
- **Shop Performance**: Analyze which shops benefit most from promotions

### **Campaign Management**
- **Active Campaigns**: Monitor currently running promotional codes
- **Performance Metrics**: Real-time usage statistics and conversion rates
- **Code Deactivation**: Disable codes early if needed
- **Historical Analysis**: Review past campaign performance and ROI

---

## 🔧 Technical Features

### **API Management**
- **Endpoint Monitoring**: Track API usage across all platform endpoints
- **Rate Limiting**: Configure and monitor API rate limits
- **Error Tracking**: Comprehensive error logging and debugging tools
- **Performance Optimization**: Database query optimization and caching controls

### **Database Administration**
- **Health Checks**: Real-time database performance monitoring
- **Connection Management**: Pool configuration and connection tracking
- **Data Integrity**: Automated checks for data consistency
- **Backup Management**: Automated daily backups with restoration capabilities

### **Deployment & Updates**
- **System Updates**: Deploy platform updates with zero downtime
- **Feature Flags**: Enable/disable features for testing and rollout
- **Environment Management**: Separate development, staging, and production controls
- **Migration Tools**: Database schema updates and data migrations

---

## 📈 Reporting & Analytics

### **Business Intelligence**
- **Custom Reports**: Generate reports for any date range or metric
- **Export Capabilities**: Download data in CSV, Excel, or PDF formats
- **Automated Reporting**: Schedule daily, weekly, or monthly reports
- **Data Visualization**: Interactive charts and graphs for trend analysis

### **Platform Metrics**
- **Growth Analytics**: Track platform growth across all key metrics
- **User Behavior**: Analyze how customers and shops use the platform
- **Financial Performance**: Revenue trends and profitability analysis
- **Market Analysis**: Compare performance across different regions and demographics

### **Compliance Reporting**
- **Regulatory Reports**: Generate reports for financial and legal compliance
- **Audit Trails**: Complete transaction and action histories
- **Data Privacy**: GDPR and privacy compliance reporting
- **Security Reports**: System security status and incident reporting

---

## 🚨 Emergency Controls

### **Platform Security**
- **Emergency Pause**: Immediately halt all platform operations if needed
- **Contract Freeze**: Pause smart contract operations for security issues
- **Account Lockdown**: Quickly suspend multiple accounts during incidents
- **Communication Blast**: Send urgent notifications to all users

### **User Flow: Emergency Platform Pause**
```
⚠️ CRITICAL PROCEDURE - SUPER ADMIN ONLY ⚠️

1. Super admin identifies critical security threat
2. Navigates to "Emergency Controls" (red warning section)
3. Clicks "EMERGENCY PAUSE" button
4. System displays confirmation dialog:
   → "This will immediately halt ALL platform operations"
   → "Are you sure you want to proceed?"
   → Requires second authentication (2FA)
5. Admin enters 2FA code and confirms
6. System immediately executes:
   → Pauses all smart contracts
   → Blocks all new transactions
   → Suspends shop and customer operations
   → Sends alert to all other admins
   → Logs emergency action with timestamp
7. Emergency status page is displayed to all users
8. Admin documents incident reason and next steps
9. Communication blast sent to all stakeholders
10. System remains paused until manual restoration
```

### **User Flow: Smart Contract Emergency Pause**
```
1. Admin detects blockchain-related security issue
2. Accesses "Contract Controls" section
3. Views current contract status:
   → RCN Contract: Active/Paused
   → RCG Contract: Active/Paused
   → Minter Contract: Active/Paused
4. Selects contract(s) to pause
5. Clicks "Pause Contract" for selected contract
6. Confirms action with reason:
   → Security vulnerability detected
   → Suspicious transaction patterns
   → Maintenance required
   → External network issues
7. System executes blockchain transaction to pause contract
8. Monitors transaction confirmation
9. Updates contract status dashboard
10. Notifies users of temporary blockchain maintenance
11. Logs action in blockchain activity audit trail
```

### **Incident Response**
- **Issue Tracking**: Log and track all platform incidents
- **Resolution Management**: Coordinate response teams and track progress
- **Communication Templates**: Pre-written responses for common issues
- **Post-Incident Analysis**: Document lessons learned and prevention measures

---

## 🎯 Key Performance Indicators (KPIs)

### **Platform Health KPIs**
- **Uptime**: 99.9% target system availability
- **Response Time**: <200ms average API response time
- **Error Rate**: <0.1% transaction failure rate
- **Customer Satisfaction**: >4.5/5 average rating

### **Business KPIs**
- **Monthly Active Users**: Track growing user engagement
- **Revenue Growth**: Month-over-month subscription revenue increase
- **Customer Acquisition Cost**: Optimize marketing and onboarding spend
- **Customer Lifetime Value**: Maximize long-term customer value

### **Technical KPIs**
- **Database Performance**: Query response times and optimization
- **Blockchain Efficiency**: Gas costs and transaction success rates
- **Security Metrics**: Incident response times and vulnerability patches
- **Code Quality**: Test coverage and deployment success rates

---

## 📋 Daily Operations Checklist

### **Morning Review (5 minutes)**
- [ ] Check system health dashboard
- [ ] Review overnight transaction volumes
- [ ] Check for any security alerts
- [ ] Review pending shop applications

### **Business Hours Monitoring**
- [ ] Monitor customer support queue
- [ ] Track real-time transaction volumes
- [ ] Review any escalated issues
- [ ] Check financial metrics and reports

### **End of Day Review (10 minutes)**
- [ ] Review daily transaction summary
- [ ] Check system performance metrics
- [ ] Prepare reports for stakeholders
- [ ] Plan next day priorities

---

## 🛠️ Troubleshooting Guide

### **Common Issues**
1. **Shop Application Delays**: Check document verification queue
2. **Customer Balance Discrepancies**: Use balance synchronization tools
3. **Payment Processing Issues**: Verify Stripe webhook configuration
4. **Token Minting Problems**: Check blockchain connectivity and gas prices

### **Emergency Procedures**
1. **System Outage**: Follow incident response protocol
2. **Security Breach**: Activate emergency lockdown procedures
3. **Financial Discrepancy**: Halt transactions and audit immediately
4. **Smart Contract Issue**: Pause contracts and contact development team

### **Support Contacts**
- **Technical Issues**: development@repaircoin.com
- **Financial Issues**: finance@repaircoin.com
- **Security Issues**: security@repaircoin.com
- **Business Issues**: operations@repaircoin.com

---

*This documentation is updated regularly. For the latest information, check the admin dashboard or contact the development team.*