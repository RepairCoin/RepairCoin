# RepairCoin Admin Features

## Overview
The RepairCoin Admin Dashboard provides comprehensive platform management capabilities for system administrators. This guide covers all currently implemented features in the system.

---

## 🏠 Dashboard Overview

### **Platform Analytics**
- **Real-time Statistics**: Total customers, shops, transactions, and platform revenue
- **Growth Metrics**: Customer acquisition rates, shop onboarding progress, and monthly trends
- **Financial Overview**: Monthly revenue from subscriptions, token sales, and treasury balance
- **System Health**: Live status of key platform components and services

### **Quick Navigation**
The admin dashboard provides tabbed navigation for:
- Overview (main dashboard)
- Customer Management (grouped/all views)
- Shop Management (applications, active shops, suspensions)
- Treasury & Token Management
- Analytics & Reporting
- Subscription Management
- Promo Code Analytics
- Admin Account Management

---

## 👥 Customer Management

### **Customer Overview Tab**
The system provides three distinct customer management views:

#### **Grouped View (Default)**
- **Tier-based Organization**: Customers organized by Bronze, Silver, and Gold tiers
- **Statistics Dashboard**: Real-time counts of customers per tier with percentage distribution
- **Quick Insights**: Total customer count, active customers, and tier progression metrics

#### **All Customers View** 
- **Complete Customer List**: Searchable table showing all registered customers
- **Customer Profiles**: Access to individual customer details including:
  - Personal information (name, email, phone, wallet address)
  - Transaction history and earning patterns
  - Current RCN balance (offchain and onchain)
  - Tier status and progression
  - Account status (active, suspended, pending verification)

#### **Unsuspend Requests View**
- **Request Queue**: List of customer-submitted unsuspension appeals
- **Decision Management**: Approve or deny unsuspension requests with documented reasoning
- **Communication Tools**: Send responses and updates to customers regarding their appeals

### **Customer Operations**
- **Advanced Search**: Find customers by multiple criteria (wallet address, email, phone, name)
- **Account Status Management**: Suspend/unsuspend customer accounts with reason tracking
- **Balance Visibility**: View detailed RCN balances including offchain operational balance
- **Transaction History**: Complete audit trail of customer token earnings and redemptions
- **Tier Tracking**: Monitor customer progression through loyalty tiers

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

The admin dashboard provides comprehensive shop management through a unified interface with multiple views:

### **Shop Management Tab**
The system offers five distinct shop management views:

#### **All Shops View (Default)**
- **Complete Shop Directory**: Comprehensive list of all shops regardless of status
- **Status Indicators**: Clear visual indicators for active, pending, rejected, and suspended shops
- **Quick Stats**: Total shop count, active shops, pending applications, and subscription status

#### **Active Shops View**
- **Operational Shops**: List of currently active and operational repair shops
- **Subscription Status**: Monitor monthly subscription payments and renewal dates
- **Performance Metrics**: Shop activity levels, transaction volumes, and customer engagement

#### **Pending Applications View**
- **Application Queue**: New shop applications awaiting admin review
- **Document Review**: Access to uploaded business licenses, tax IDs, and registration documents
- **Approval Workflow**: Approve, reject, or request additional information from applicants
- **Contact Verification**: Tools to validate shop contact information and business details

#### **Rejected Applications View**
- **Declined Applications**: Historical record of rejected shop applications
- **Rejection Reasons**: Documented reasons for application rejections
- **Reapplication Tracking**: Monitor shops that resubmit applications after rejection

#### **Unsuspend Requests View**
- **Suspension Appeals**: List of shop-submitted requests for account reinstatement
- **Review Process**: Detailed review of suspension reasons and shop appeals
- **Decision Management**: Approve or deny unsuspension requests with documentation

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

## 💰 Treasury & Financial Management

### **Treasury Tab**
The Treasury tab provides comprehensive financial oversight and token management:

#### **Treasury Operations**
- **RCN Treasury Balance**: Real-time monitoring of admin RCN token reserves
- **Token Distribution Tracking**: Monitor RCN tokens distributed to shops and customers
- **Revenue Dashboard**: Detailed breakdown of platform revenue streams including:
  - Monthly subscription revenue from shops ($500/month per shop)
  - RCN token sales to shops (tiered pricing based on RCG holdings)
  - Platform transaction fees and commissions

#### **Token Management**
- **Manual Token Controls**: Administrative minting capabilities for special circumstances
- **Supply Monitoring**: Track total RCN token supply and circulation metrics
- **Burn Tracking**: Record token burns from customer redemptions
- **Treasury Analytics**: Monitor treasury health and token distribution patterns

#### **Financial Oversight**
- **Subscription Management**: Track shop subscription payments and renewal status
- **Revenue Analytics**: Monthly and quarterly financial performance reports
- **Cost Analysis**: Platform operational costs vs. revenue generation
- **Financial Health Metrics**: Key indicators for platform sustainability

---

## 🛡️ System Administration

### **Admin Management**
The system provides two administrative tabs for managing platform access:

#### **Admins Tab (Super Admin Only)**
- **Admin Directory**: Complete list of all admin accounts with role assignments
- **Permission Management**: Assign and modify admin roles (admin vs super_admin)
- **Access Control**: Enable, disable, or revoke admin access as needed
- **Activity Monitoring**: Track admin actions and login history

#### **Create Admin Tab**
- **New Admin Setup**: Interface for creating new administrative accounts
- **Role Assignment**: Set initial permission levels for new admins
- **Account Configuration**: Configure admin access levels and restrictions
- **Invitation System**: Send admin account setup instructions to new team members

### **Security & Access Control**
- **Role-Based Access**: Granular permission system with admin and super_admin levels
- **Wallet-Based Authentication**: Secure login using cryptocurrency wallet signatures
- **Activity Logging**: Complete audit trail of all administrative actions
- **Session Management**: Secure session handling and timeout controls

---

## 📊 Analytics & Reporting

### **Analytics Tab**
Comprehensive platform analytics and performance monitoring:

#### **Service Marketplace Analytics** ✅ **NEW (December 4, 2024)**
- **Marketplace Health Score**: Overall platform health score (0-100) based on:
  - Average service rating (out of 5 stars)
  - Service activation rate (active vs total services)
  - Order completion rate (completed vs total orders)
  - Average service conversion rate (orders per view)
- **Platform Performance Overview**:
  - Total services across all shops
  - Total orders and revenue
  - Platform-wide conversion rates
  - Average customer satisfaction
- **Top Performing Shops**: Top 5 shops by:
  - Total revenue generated
  - Number of orders completed
  - Service views and engagement
  - Average customer ratings
- **Top Service Categories**: Category performance metrics:
  - Total services per category
  - Average price by category
  - Order volume and revenue
  - Average ratings per category
- **Revenue Trends**: Time-based revenue analysis:
  - Last 7, 30, or 90 days
  - Daily revenue patterns
  - Growth trends and projections
- **Order Analytics**: Order volume and trends:
  - Daily order counts
  - Completion rates
  - Average order values
- **Service Adoption**: Track service marketplace growth:
  - New services added
  - Service activation rates
  - Shop participation metrics
- **Customer Satisfaction**: Platform-wide review metrics:
  - Average ratings across all services
  - Total reviews submitted
  - Review response rates from shops

#### **Platform Performance**
- **User Engagement**: Customer and shop activity metrics
- **Transaction Analytics**: Volume trends, success rates, and processing times
- **Revenue Analysis**: Financial performance tracking and growth metrics
- **Geographic Distribution**: Regional usage patterns and market penetration

#### **Business Intelligence**
- **Growth Metrics**: Customer acquisition rates and retention statistics
- **Market Analysis**: Competitive analysis and industry benchmarking
- **Predictive Analytics**: Trend forecasting and business projections
- **Custom Reports**: Generate tailored reports for specific business needs

---

## 🎯 Subscription Management

### **Subscriptions Tab**
Monitor and manage shop subscription billing:

#### **Subscription Overview**
- **Active Subscriptions**: List of shops with current $500/month subscriptions
- **Payment Status**: Track successful payments, failed transactions, and overdue accounts
- **Renewal Management**: Monitor upcoming renewals and subscription expiration dates
- **Revenue Tracking**: Subscription-based revenue analytics and projections

#### **Billing Operations**
- **Payment Processing**: Integration with Stripe for secure payment handling
- **Subscription Lifecycle**: Manage subscription creation, modification, and cancellation
- **Dunning Management**: Handle failed payments and account recovery processes
- **Financial Reporting**: Detailed subscription revenue reports and forecasting

---

## 🏷️ Promo Code Management

### **Promo Codes Tab**
Advanced promotional campaign management:

#### **Campaign Analytics**
- **Usage Tracking**: Monitor promotional code usage and redemption rates
- **Performance Metrics**: Analyze campaign effectiveness and ROI
- **Revenue Impact**: Track revenue generated or discounted through promotions
- **Customer Acquisition**: Measure new customer acquisition through promo campaigns

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

## 🔐 Access Control & Permissions

### **Role-Based Access System**
The admin dashboard implements a comprehensive permission system:

#### **Super Admin Privileges**
- **Full System Access**: Complete access to all administrative functions
- **Admin Management**: Create, modify, and remove admin accounts
- **Critical Operations**: Access to treasury, financial controls, and system-wide settings
- **Emergency Controls**: Platform-wide emergency pause and security functions

#### **Standard Admin Privileges**
- **Customer Management**: Full customer account management and support functions
- **Shop Management**: Shop application review, approval, and ongoing management
- **Analytics Access**: Business intelligence and reporting capabilities
- **Subscription Management**: Shop billing and subscription oversight

### **Security Features**
- **Wallet Authentication**: Secure login using cryptocurrency wallet signatures
- **Session Security**: Encrypted sessions with automatic timeout
- **Audit Logging**: Complete record of all administrative actions
- **Multi-Factor Security**: Additional security layers for sensitive operations

---

## 📊 Current Tab Structure

### **Implemented Admin Tabs**
Based on the actual system implementation, the following tabs are available:

1. **Overview** - Main dashboard with platform statistics and quick actions
2. **Customers** - Customer management with grouped/all/unsuspend views
3. **Shop Management** - Unified shop management with all/active/pending/rejected/unsuspend views
4. **Treasury** - Financial oversight and token management
5. **Analytics** - Platform performance and business intelligence
6. **Subscriptions** - Shop subscription billing and management
7. **Promo Codes** - Promotional campaign analytics and management
8. **Admins** (Super Admin only) - Admin account directory and management
9. **Create Admin** - New admin account creation interface

### **Tab Visibility Rules**
- **All Users**: Overview, Create Admin tabs
- **Admin & Super Admin**: Customers, Shop Management, Treasury, Analytics, Subscriptions, Promo Codes
- **Super Admin Only**: Admins tab for managing other administrators

---

## 🚀 System Architecture

### **Frontend Architecture**
- **React-based Dashboard**: Modern, responsive admin interface
- **Lazy Loading**: Performance optimization with tab-based lazy loading
- **Real-time Updates**: Live data updates for critical metrics
- **Mobile Responsive**: Full functionality on tablets and mobile devices

### **Backend Integration**
- **RESTful APIs**: Comprehensive API integration for all admin functions
- **Database Connectivity**: Direct database access for complex queries
- **Blockchain Integration**: Smart contract interaction for token operations
- **Third-party Services**: Stripe integration for subscription management

---

## 🚨 Emergency Controls

### **Emergency Freeze System**
The platform now includes a comprehensive emergency freeze system for critical security incidents:

#### **Emergency Freeze Capabilities**
- **Instant System Lockdown**: Freeze all critical treasury operations immediately
- **Component-Level Control**: Selectively freeze specific system components:
  - `token_minting`: Halt all token creation operations
  - `shop_purchases`: Block new RCN purchases by shops
  - `customer_rewards`: Suspend reward distribution
  - `token_transfers`: Stop manual token transfers
- **Smart Contract Pausing**: Automatically pause token contracts during freeze
- **Administrator Alerts**: Real-time notifications to all admin team members
- **Complete Audit Trail**: Detailed logging of all freeze/unfreeze actions

#### **Freeze Status Monitoring**
- **Real-time Status Display**: Live freeze status banner in admin dashboard
- **Component Status Tracking**: Individual component freeze indicators
- **Historical Audit**: Complete history of emergency actions with timestamps
- **Admin Activity Logs**: Track which admin initiated freeze/unfreeze actions

### **Platform Security**
- **Emergency Pause**: Immediately halt all platform operations if needed
- **Contract Freeze**: Pause smart contract operations for security issues
- **Account Lockdown**: Quickly suspend multiple accounts during incidents
- **Communication Blast**: Send urgent notifications to all users

### **User Flow: Emergency Freeze Activation**
```
🚨 CRITICAL PROCEDURE - ADMIN/SUPER ADMIN 🚨

1. Admin identifies critical security threat or system issue
2. Navigates to "Advanced Treasury Management" tab
3. Clicks red "Emergency Freeze" button in top-right corner
4. System displays emergency freeze modal:
   → Warning about system-wide impact
   → Text field for mandatory reason explanation
   → "This will freeze all critical treasury operations"
5. Admin enters detailed reason for the freeze
6. Clicks "🚨 Emergency Freeze" to confirm
7. System immediately executes freeze:
   → Pauses token minting operations
   → Blocks new shop purchases
   → Suspends customer reward distribution
   → Halts manual token transfers
   → Attempts to pause smart contracts
   → Creates audit trail entry
   → Sends alerts to all administrators
8. Red freeze status banner appears across admin dashboard
9. All affected endpoints return 503 errors with freeze message
10. System remains frozen until manually lifted by admin
```

### **User Flow: Emergency Freeze Lift**
```
✅ RECOVERY PROCEDURE - ADMIN/SUPER ADMIN ✅

1. Admin determines security issue has been resolved
2. Views red freeze status banner showing:
   → Current freeze status and affected components
   → Original freeze reason and timestamp
   → Admin who initiated the freeze
3. Clicks "Lift Freeze" button in status banner OR
   Clicks green "Lift Emergency Freeze" button in top-right
4. System displays unfreeze confirmation modal:
   → Current freeze details and duration
   → Text field for mandatory reason explanation
   → "This will restore all treasury operations"
5. Admin enters detailed reason for lifting freeze
6. Clicks "✅ Lift Emergency Freeze" to confirm
7. System executes unfreeze:
   → Unpauses smart contracts
   → Restores token minting operations
   → Re-enables shop purchases
   → Resumes customer reward distribution
   → Allows manual token transfers
   → Creates audit trail entry
   → Sends restoration alerts to all administrators
8. Green success banner briefly appears
9. All operations return to normal functionality
10. Freeze status banner disappears from dashboard
```

### **User Flow: Emergency Platform Pause (Legacy)**
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

### **Admin Dashboard Review**
- [ ] Check Overview tab for platform health and key metrics
- [ ] Review new customer registrations and tier progressions
- [ ] Monitor pending shop applications in Shop Management tab
- [ ] Check Treasury balance and recent financial activity
- [ ] Review Analytics for any unusual patterns or trends

### **Customer & Shop Management**
- [ ] Process any pending customer unsuspension requests
- [ ] Review and approve/reject shop applications
- [ ] Monitor subscription payment status and renewals
- [ ] Check for any customer or shop support issues

### **Financial & Performance Monitoring**
- [ ] Review daily transaction volumes and revenue
- [ ] Monitor promo code campaign performance
- [ ] Check subscription billing status and failed payments
- [ ] Analyze platform growth metrics and KPIs

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

---

## 📝 Recent Updates

### **December 2024 Updates**
- **Service Marketplace Analytics**: Comprehensive platform-wide service marketplace insights
- **Marketplace Health Score**: New 0-100 scoring system based on 4 key metrics
- **Top Shops & Categories**: Performance tracking for top performing shops and service categories
- **Revenue & Order Trends**: Time-based analytics with customizable time periods
- **Customer Satisfaction Metrics**: Platform-wide review and rating analytics

### **Current System Status**
- All administrative functions are fully operational
- Real-time data updates across all dashboard tabs
- Complete role-based access control implementation
- Integrated subscription and promo code management

### **Latest Features**
- Enhanced customer management with tier-based organization
- Unified shop management interface with multiple view options
- Comprehensive treasury and financial oversight tools
- Advanced analytics and reporting capabilities
- Service marketplace analytics and health monitoring

---

*This documentation reflects the current admin system implementation as of December 2024. For technical support or feature requests, contact the development team.*