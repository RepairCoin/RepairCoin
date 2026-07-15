import { agencyRepository, adminRepository } from '../../../repositories';
import { Agency, CreateAgencyInput, AgencyClientShop } from '../../../repositories/AgencyRepository';
import { logger } from '../../../utils/logger';

export interface AgencyManagerContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface AgencyProfile {
  agency: Agency;
  activeClientCount: number;
  clientLimit: number;
  accountManager: AgencyManagerContact | null;
}

export class AgencyService {
  /** Admin provisions a new agency (sales-assisted flow). */
  async provisionAgency(input: CreateAgencyInput): Promise<Agency> {
    if (!input.name || !input.name.trim()) {
      throw new Error('Agency name is required');
    }
    if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
      throw new Error('Please enter a valid contact email');
    }
    // An owner wallet can only back one agency.
    if (input.ownerWalletAddress) {
      const existing = await agencyRepository.getAgencyByOwner(input.ownerWalletAddress);
      if (existing) {
        throw new Error('An agency already exists for this owner wallet');
      }
    }
    if (input.accountManagerAddress) {
      const manager = await adminRepository.getAdmin(input.accountManagerAddress);
      if (!manager || manager.isActive === false) {
        throw new Error('Account manager must be an active admin');
      }
    }
    return agencyRepository.createAgency(input);
  }

  async listAgencies(): Promise<Agency[]> {
    return agencyRepository.listAgencies();
  }

  /** The requesting agency's profile: account + client usage + AM contact. */
  async getAgencyProfile(agencyId: string): Promise<AgencyProfile> {
    const agency = await agencyRepository.getAgency(agencyId);
    if (!agency) {
      throw new Error('Agency not found');
    }
    const activeClientCount = await agencyRepository.getActiveClientCount(agencyId);

    let accountManager: AgencyManagerContact | null = null;
    if (agency.accountManagerAddress) {
      try {
        const admin = await adminRepository.getAdmin(agency.accountManagerAddress);
        if (admin && admin.isActive !== false) {
          accountManager = {
            name: admin.name ?? null,
            email: admin.email ?? null,
            phone: admin.phone ?? null,
          };
        }
      } catch (error) {
        logger.warn('Failed to load agency account manager', { agencyId });
      }
    }

    return {
      agency,
      activeClientCount,
      clientLimit: agency.clientLimit,
      accountManager,
    };
  }

  async listClients(agencyId: string): Promise<AgencyClientShop[]> {
    return agencyRepository.listClients(agencyId);
  }
}

export const agencyService = new AgencyService();
