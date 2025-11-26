// backend/src/domains/ServiceDomain/controllers/ReviewController.ts
import { Request, Response } from 'express';
import { ReviewRepository } from '../../../repositories/ReviewRepository';
import { OrderRepository } from '../../../repositories/OrderRepository';
import { logger } from '../../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const reviewRepository = new ReviewRepository();
const orderRepository = new OrderRepository();

export class ReviewController {
  /**
   * Create a review
   * POST /api/services/reviews
   */
  async createReview(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, rating, comment, images } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate input
      if (!orderId || !rating) {
        res.status(400).json({ error: 'Order ID and rating are required' });
        return;
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' });
        return;
      }

      // Get order details
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Verify order belongs to customer
      if (order.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
        res.status(403).json({ error: 'You can only review your own orders' });
        return;
      }

      // Verify order is completed
      if (order.status !== 'completed') {
        res.status(400).json({ error: 'You can only review completed orders' });
        return;
      }

      // Check if review already exists
      const existingReview = await reviewRepository.getReviewByOrderId(orderId);
      if (existingReview) {
        res.status(400).json({ error: 'You have already reviewed this order' });
        return;
      }

      // Create review
      const reviewId = uuidv4();
      const review = await reviewRepository.createReview({
        reviewId,
        serviceId: order.serviceId,
        orderId,
        customerAddress,
        shopId: order.shopId,
        rating,
        comment,
        images: images || []
      });

      res.status(201).json({
        success: true,
        data: review
      });
    } catch (error) {
      logger.error('Error creating review:', error);
      res.status(500).json({
        error: 'Failed to create review'
      });
    }
  }

  /**
   * Get service reviews
   * GET /api/services/:serviceId/reviews
   */
  async getServiceReviews(req: Request, res: Response): Promise<void> {
    try {
      const { serviceId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;

      const result = await reviewRepository.getServiceReviews(serviceId, {
        page,
        limit,
        rating
      });

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error fetching service reviews:', error);
      res.status(500).json({
        error: 'Failed to fetch reviews'
      });
    }
  }

  /**
   * Get customer reviews
   * GET /api/services/reviews/customer
   */
  async getCustomerReviews(req: Request, res: Response): Promise<void> {
    try {
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await reviewRepository.getCustomerReviews(customerAddress, {
        page,
        limit
      });

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error fetching customer reviews:', error);
      res.status(500).json({
        error: 'Failed to fetch reviews'
      });
    }
  }

  /**
   * Get shop reviews
   * GET /api/services/reviews/shop
   */
  async getShopReviews(req: Request, res: Response): Promise<void> {
    try {
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;

      const result = await reviewRepository.getShopReviews(shopId, {
        page,
        limit,
        rating
      });

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error fetching shop reviews:', error);
      res.status(500).json({
        error: 'Failed to fetch reviews'
      });
    }
  }

  /**
   * Update a review
   * PUT /api/services/reviews/:reviewId
   */
  async updateReview(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { rating, comment, images } = req.body;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get existing review
      const existingReview = await reviewRepository.getReviewById(reviewId);
      if (!existingReview) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      // Verify review belongs to customer
      if (existingReview.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
        res.status(403).json({ error: 'You can only update your own reviews' });
        return;
      }

      // Update review
      const updatedReview = await reviewRepository.updateReview(reviewId, {
        rating,
        comment,
        images
      });

      res.json({
        success: true,
        data: updatedReview
      });
    } catch (error) {
      logger.error('Error updating review:', error);
      res.status(500).json({
        error: 'Failed to update review'
      });
    }
  }

  /**
   * Add shop response
   * POST /api/services/reviews/:reviewId/respond
   */
  async addShopResponse(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const { response } = req.body;
      const shopId = req.user?.shopId;

      if (!shopId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!response) {
        res.status(400).json({ error: 'Response text is required' });
        return;
      }

      // Get existing review
      const existingReview = await reviewRepository.getReviewById(reviewId);
      if (!existingReview) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      // Verify review is for this shop
      if (existingReview.shopId !== shopId) {
        res.status(403).json({ error: 'You can only respond to reviews for your shop' });
        return;
      }

      // Add response
      const updatedReview = await reviewRepository.addShopResponse(reviewId, response);

      res.json({
        success: true,
        data: updatedReview
      });
    } catch (error) {
      logger.error('Error adding shop response:', error);
      res.status(500).json({
        error: 'Failed to add response'
      });
    }
  }

  /**
   * Mark review as helpful
   * POST /api/services/reviews/:reviewId/helpful
   */
  async markHelpful(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;

      await reviewRepository.markHelpful(reviewId);

      res.json({
        success: true,
        message: 'Review marked as helpful'
      });
    } catch (error) {
      logger.error('Error marking review helpful:', error);
      res.status(500).json({
        error: 'Failed to mark review as helpful'
      });
    }
  }

  /**
   * Delete a review
   * DELETE /api/services/reviews/:reviewId
   */
  async deleteReview(req: Request, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get existing review
      const existingReview = await reviewRepository.getReviewById(reviewId);
      if (!existingReview) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }

      // Verify review belongs to customer
      if (existingReview.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
        res.status(403).json({ error: 'You can only delete your own reviews' });
        return;
      }

      await reviewRepository.deleteReview(reviewId);

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting review:', error);
      res.status(500).json({
        error: 'Failed to delete review'
      });
    }
  }

  /**
   * Check if customer can review order
   * GET /api/services/reviews/can-review/:orderId
   */
  async canReview(req: Request, res: Response): Promise<void> {
    try {
      const { orderId } = req.params;
      const customerAddress = req.user?.address;

      if (!customerAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get order
      const order = await orderRepository.getOrderById(orderId);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      // Check if order belongs to customer
      if (order.customerAddress.toLowerCase() !== customerAddress.toLowerCase()) {
        res.json({
          success: true,
          data: { canReview: false, reason: 'Not your order' }
        });
        return;
      }

      // Check if order is completed
      if (order.status !== 'completed') {
        res.json({
          success: true,
          data: { canReview: false, reason: 'Order not completed' }
        });
        return;
      }

      // Check if already reviewed
      const existingReview = await reviewRepository.getReviewByOrderId(orderId);
      if (existingReview) {
        res.json({
          success: true,
          data: { canReview: false, reason: 'Already reviewed', reviewId: existingReview.reviewId }
        });
        return;
      }

      res.json({
        success: true,
        data: { canReview: true }
      });
    } catch (error) {
      logger.error('Error checking review eligibility:', error);
      res.status(500).json({
        error: 'Failed to check review eligibility'
      });
    }
  }
}
