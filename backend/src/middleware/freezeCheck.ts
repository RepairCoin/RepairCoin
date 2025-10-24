import { Request, Response, NextFunction } from 'express';
import { getEmergencyFreezeService } from '../services/EmergencyFreezeService';
import { logger } from '../utils/logger';

/**
 * Middleware to check if a system component is frozen before allowing operations
 */
export const checkFreezeStatus = (component: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const freezeService = getEmergencyFreezeService();
            const isFrozen = await freezeService.isComponentFrozen(component);
            
            if (isFrozen) {
                logger.warn(`🚨 Blocked operation on frozen component: ${component}`, {
                    component,
                    endpoint: req.path,
                    method: req.method,
                    userAddress: req.user?.address,
                    timestamp: new Date().toISOString()
                });
                
                return res.status(503).json({
                    success: false,
                    error: 'Service temporarily unavailable',
                    message: `The ${component.replace('_', ' ')} service is currently frozen due to emergency maintenance. Please try again later.`,
                    component,
                    frozen: true,
                    code: 'EMERGENCY_FREEZE_ACTIVE'
                });
            }
            
            next();
        } catch (error) {
            logger.error(`Error checking freeze status for ${component}:`, error);
            // If we can't check freeze status, allow the operation to continue
            // This ensures the system doesn't break if the freeze service is down
            next();
        }
    };
};

/**
 * Middleware specifically for token minting operations
 */
export const checkTokenMintingFreeze = checkFreezeStatus('token_minting');

/**
 * Middleware specifically for shop purchase operations
 */
export const checkShopPurchaseFreeze = checkFreezeStatus('shop_purchases');

/**
 * Middleware specifically for customer reward operations
 */
export const checkCustomerRewardFreeze = checkFreezeStatus('customer_rewards');

/**
 * Middleware specifically for token transfer operations
 */
export const checkTokenTransferFreeze = checkFreezeStatus('token_transfers');

/**
 * Comprehensive freeze check for critical treasury operations
 */
export const checkCriticalOperationFreeze = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const freezeService = getEmergencyFreezeService();
        const systemStatus = await freezeService.getSystemStatus();
        
        // Check if any critical component is frozen
        const frozenComponents = systemStatus.filter(status => status.is_frozen);
        
        if (frozenComponents.length > 0) {
            const frozenNames = frozenComponents.map(c => c.component.replace('_', ' ')).join(', ');
            
            logger.warn(`🚨 Blocked critical operation due to frozen components: ${frozenNames}`, {
                frozenComponents: frozenComponents.map(c => c.component),
                endpoint: req.path,
                method: req.method,
                userAddress: req.user?.address,
                timestamp: new Date().toISOString()
            });
            
            return res.status(503).json({
                success: false,
                error: 'Critical services unavailable',
                message: `Critical treasury operations are frozen: ${frozenNames}. Please contact system administrators.`,
                frozenComponents: frozenComponents.map(c => ({
                    component: c.component,
                    frozen_at: c.frozen_at,
                    frozen_by: c.frozen_by,
                    freeze_reason: c.freeze_reason
                })),
                frozen: true,
                code: 'CRITICAL_SERVICES_FROZEN'
            });
        }
        
        next();
    } catch (error) {
        logger.error('Error checking critical operation freeze status:', error);
        // Allow operation to continue if freeze check fails
        next();
    }
};