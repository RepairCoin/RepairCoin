import { Request, Response } from 'express';
import { agencyService } from '../services/AgencyService';
import { ResponseHelper } from '../../../utils/responseHelper';

export class AgencyController {
  // GET /api/agency/me — the owning shop's agency profile (account + client usage + AM contact),
  // or { agency: null } when the shop hasn't activated the add-on.
  //
  // Not having an agency is the NORMAL state for most shops, not an error. This endpoint is a
  // status probe hit on every shop dashboard load (sidebar nav + add-ons map), so answering 404
  // meant every ordinary shop logged two warn lines per load and drowned out real 404s.
  async getMyAgency(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const agency = await agencyService.getAgencyForShop(shopId);
      if (!agency) {
        ResponseHelper.success(res, { agency: null });
        return;
      }
      const profile = await agencyService.getAgencyProfileForShop(shopId);
      ResponseHelper.success(res, profile);
    } catch (error: any) {
      const status = error?.message === 'This shop does not have an active agency' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency/clients — the owning shop's active client shops.
  async getMyClients(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const clients = await agencyService.listClientsForShop(shopId);
      ResponseHelper.success(res, clients);
    } catch (error: any) {
      const status = error?.message === 'This shop does not have an active agency' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // POST /api/agency/activate — self-serve: start Stripe checkout for the $999/mo Agency Program.
  // The agency is provisioned only once payment succeeds (checkout.session.completed webhook).
  async activate(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const { billingEmail, billingContact, name } = req.body ?? {};
      const result = await agencyService.createActivationCheckoutSession(shopId, {
        billingEmail,
        billingContact,
        name,
      });
      ResponseHelper.success(res, result);
    } catch (error: any) {
      const clientErrors = [
        'This shop already has an active agency',
        'Owner shop not found',
        'A billing email is required to activate the Agency Program',
      ];
      const status = clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // POST /api/agency/cancel — schedule the owning shop's Agency Program to cancel at period end.
  async cancel(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const result = await agencyService.cancelForShop(shopId);
      ResponseHelper.success(res, result, 'Agency Program will cancel at the end of the billing period');
    } catch (error: any) {
      const clientErrors = [
        'This shop does not have an active agency',
        'No active agency subscription to cancel',
      ];
      const status = clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // POST /api/agency/invites — mint a client invite link for the owning shop's agency.
  async createInvite(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const { label } = req.body ?? {};
      const invite = await agencyService.createInvite(shopId, label);
      ResponseHelper.success(res, invite, 'Invite created', 201);
    } catch (error: any) {
      const status = error?.message === 'This shop does not have an active agency' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency/invites — the owning shop's pending client invites.
  async listInvites(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const invites = await agencyService.listPendingInvites(shopId);
      ResponseHelper.success(res, invites);
    } catch (error: any) {
      const status = error?.message === 'This shop does not have an active agency' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // DELETE /api/agency/invites/:token — revoke a pending invite.
  async revokeInvite(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      await agencyService.revokeInvite(shopId, req.params.token);
      ResponseHelper.success(res, { revoked: true });
    } catch (error: any) {
      const status = error?.message === 'Invite not found or already used' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency/invite-info/:token — public: validate an invite for the signup banner.
  async getInviteInfo(req: Request, res: Response) {
    try {
      const info = await agencyService.getInviteInfo(req.params.token);
      ResponseHelper.success(res, info);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }

  // POST /api/agency/clients — create a new client shop under the owning shop's agency.
  async createClient(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      const { shopId: clientShopId, name, walletAddress, email, phone, address, location } = req.body ?? {};
      const client = await agencyService.createClientForShop(shopId, {
        shopId: clientShopId,
        name,
        walletAddress,
        email,
        phone,
        address,
        location,
      });
      ResponseHelper.success(res, client, 'Client shop created', 201);
    } catch (error: any) {
      const clientErrors = [
        'shopId, name, and walletAddress are required',
        'An agency cannot add its own shop as a client',
        'Shop ID already exists',
        'Wallet address already registered to another shop',
        'This shop does not have an active agency',
      ];
      const status = clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // DELETE /api/agency/clients/:shopId — unlink a client shop.
  async removeClient(req: Request, res: Response) {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        ResponseHelper.error(res, 'Shop session required', 401);
        return;
      }
      await agencyService.removeClientForShop(shopId, req.params.shopId);
      ResponseHelper.success(res, { removed: true });
    } catch (error: any) {
      const status = error?.message === 'Shop is not a client of this agency' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // POST /api/agency (admin) — provision an agency for a shop (backdoor; self-serve is the addon).
  async provisionAgency(req: Request, res: Response) {
    try {
      const { ownerShopId, name, contactEmail, contactPhone, accountManagerAddress, clientLimit, perClientPriceCents } = req.body ?? {};
      const agency = await agencyService.provisionAgency({
        ownerShopId,
        name,
        contactEmail,
        contactPhone,
        accountManagerAddress,
        clientLimit,
        perClientPriceCents,
      });
      ResponseHelper.success(res, agency, 'Agency provisioned', 201);
    } catch (error: any) {
      const clientErrors = [
        'Owner shop is required',
        'Agency name is required',
        'Please enter a valid contact email',
        'Owner shop not found',
        'This shop already has an agency',
        'Account manager must be an active admin',
      ];
      const status = clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency/:id/clients (admin) — the client shops of a given agency.
  async getAgencyClients(req: Request, res: Response) {
    try {
      const clients = await agencyService.listClientsForAgencyId(req.params.id);
      ResponseHelper.success(res, clients);
    } catch (error: any) {
      const status = error?.message === 'Agency not found' ? 404 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // PATCH /api/agency/:id/account-manager (admin) — assign or clear the agency's account manager.
  async assignAccountManager(req: Request, res: Response) {
    try {
      const { accountManagerAddress } = req.body ?? {};
      const agency = await agencyService.setAccountManager(
        req.params.id,
        accountManagerAddress || null
      );
      ResponseHelper.success(res, agency, 'Account manager updated');
    } catch (error: any) {
      const clientErrors = ['Agency not found', 'Account manager must be an active admin'];
      const status = error?.message === 'Agency not found'
        ? 404
        : clientErrors.includes(error?.message) ? 400 : 500;
      ResponseHelper.error(res, error.message, status);
    }
  }

  // GET /api/agency (admin) — list all agencies with display stats for the admin roster.
  async listAgencies(_req: Request, res: Response) {
    try {
      const agencies = await agencyService.listAgenciesWithStats();
      ResponseHelper.success(res, agencies);
    } catch (error: any) {
      ResponseHelper.error(res, error.message, 500);
    }
  }
}
