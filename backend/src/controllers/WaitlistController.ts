import { Request, Response } from 'express';
import WaitlistRepository from '../repositories/WaitlistRepository';

/**
 * Submit a new waitlist entry (public endpoint)
 */
export const submitWaitlist = async (req: Request, res: Response) => {
  try {
    const { email, userType } = req.body;

    // Validation
    if (!email || !userType) {
      return res.status(400).json({
        success: false,
        error: 'Email and user type are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validate user type
    if (!['customer', 'shop'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'User type must be either "customer" or "shop"'
      });
    }

    // Check if email already exists
    const exists = await WaitlistRepository.existsByEmail(email.toLowerCase());
    if (exists) {
      return res.status(409).json({
        success: false,
        error: 'This email is already on the waitlist'
      });
    }

    // Create waitlist entry
    const entry = await WaitlistRepository.create({
      email: email.toLowerCase(),
      userType
    });

    return res.status(201).json({
      success: true,
      message: 'Successfully added to waitlist',
      data: {
        id: entry.id,
        email: entry.email,
        userType: entry.userType,
        status: entry.status,
        createdAt: entry.createdAt
      }
    });
  } catch (error) {
    console.error('Error submitting waitlist:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit waitlist entry'
    });
  }
};

/**
 * Get all waitlist entries (admin only)
 */
export const getWaitlistEntries = async (req: Request, res: Response) => {
  try {
    const {
      limit = '50',
      offset = '0',
      status,
      userType
    } = req.query;

    const result = await WaitlistRepository.getAll({
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      status: status as string,
      userType: userType as string
    });

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching waitlist entries:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch waitlist entries'
    });
  }
};

/**
 * Get waitlist statistics (admin only)
 */
export const getWaitlistStats = async (req: Request, res: Response) => {
  try {
    const stats = await WaitlistRepository.getStats();

    return res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching waitlist stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch waitlist statistics'
    });
  }
};

/**
 * Update waitlist entry status (admin only)
 */
export const updateWaitlistStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    if (!['pending', 'contacted', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value'
      });
    }

    const entry = await WaitlistRepository.updateStatus({
      id,
      status,
      notes
    });

    return res.json({
      success: true,
      message: 'Waitlist entry updated successfully',
      data: entry
    });
  } catch (error) {
    console.error('Error updating waitlist entry:', error);

    if (error instanceof Error && error.message === 'Waitlist entry not found') {
      return res.status(404).json({
        success: false,
        error: 'Waitlist entry not found'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update waitlist entry'
    });
  }
};

/**
 * Delete waitlist entry (admin only)
 */
export const deleteWaitlistEntry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await WaitlistRepository.delete(id);

    return res.json({
      success: true,
      message: 'Waitlist entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting waitlist entry:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete waitlist entry'
    });
  }
};
