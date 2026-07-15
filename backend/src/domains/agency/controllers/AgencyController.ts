import { Request, Response } from 'express';
import { agencyService } from '../services/AgencyService';
import { ResponseHelper } from '../../../utils/responseHelper';

export class AgencyController {
  // GET /api/agency/me — the requesting agency's profile (account + client usage + AM contact).
  async getMyAgency(req: Request, res: Response) {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        ResponseHelper.error(res, 'Agency ID not found in token', 401);
        return;
      }
      const profile = await agencyService.getAgencyProfile(agencyId);
      ResponseHelper.success(res, profile);
    } catch (error: any) {
      const status = error?.message === 'Agency not found' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency/clients — the requesting agency's active client shops.
  async getMyClients(req: Request, res: Response) {
    try {
      const agencyId = req.user?.agencyId;
      if (!agencyId) {
        ResponseHelper.error(res, 'Agency ID not found in token', 401);
        return;
      }
      const clients = await agencyService.listClients(agencyId);
      ResponseHelper.success(res, clients);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  // POST /api/agency (admin) — provision a new agency (sales-assisted).
  async provisionAgency(req: Request, res: Response) {
    try {
      const { name, ownerWalletAddress, contactEmail, contactPhone, accountManagerAddress, clientLimit, perClientPriceCents } = req.body ?? {};
      const agency = await agencyService.provisionAgency({
        name,
        ownerWalletAddress,
        contactEmail,
        contactPhone,
        accountManagerAddress,
        clientLimit,
        perClientPriceCents,
      });
      ResponseHelper.success(res, agency, 'Agency provisioned', 201);
    } catch (error: any) {
      const clientErrors = [
        'Agency name is required',
        'Please enter a valid contact email',
        'An agency already exists for this owner wallet',
        'Account manager must be an active admin',
      ];
      const status = clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency (admin) — list all agencies.
  async listAgencies(_req: Request, res: Response) {
    try {
      const agencies = await agencyService.listAgencies();
      ResponseHelper.success(res, agencies);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }
}
