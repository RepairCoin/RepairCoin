// backend/src/domains/AdsDomain/controllers/ExperimentController.ts
//
// Ads System Stage 5 — A/B experiments (admin). Create/list per campaign, pull
// the per-creative report, and declare a winner.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { ExperimentRepository } from '../repositories/ExperimentRepository';

const experiments = new ExperimentRepository();

// POST /campaigns/:id/experiments (admin)
export async function createExperiment(req: Request, res: Response): Promise<void> {
  const name = req.body?.name;
  if (!name) { res.status(400).json({ success: false, error: 'name is required' }); return; }
  try {
    const exp = await experiments.create(req.params.id, name);
    res.status(201).json({ success: true, data: exp });
  } catch (err) {
    logger.error('ExperimentController.createExperiment failed', err);
    res.status(500).json({ success: false, error: 'Failed to create experiment' });
  }
}

// GET /campaigns/:id/experiments (admin)
export async function listExperiments(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await experiments.listByCampaign(req.params.id) });
  } catch (err) {
    logger.error('ExperimentController.listExperiments failed', err);
    res.status(500).json({ success: false, error: 'Failed to list experiments' });
  }
}

// GET /experiments/:id/report (admin) — per-creative leads/bookings/conversion
export async function getExperimentReport(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await experiments.getReport(req.params.id) });
  } catch (err) {
    logger.error('ExperimentController.getExperimentReport failed', err);
    res.status(500).json({ success: false, error: 'Failed to get report' });
  }
}

// PATCH /experiments/:id/winner (admin) — declare a winner + end the experiment
export async function setExperimentWinner(req: Request, res: Response): Promise<void> {
  const creativeId = req.body?.creativeId;
  if (!creativeId) { res.status(400).json({ success: false, error: 'creativeId is required' }); return; }
  try {
    const exp = await experiments.setWinner(req.params.id, creativeId);
    if (!exp) { res.status(404).json({ success: false, error: 'Experiment not found' }); return; }
    res.json({ success: true, data: exp });
  } catch (err) {
    logger.error('ExperimentController.setExperimentWinner failed', err);
    res.status(500).json({ success: false, error: 'Failed to set winner' });
  }
}
