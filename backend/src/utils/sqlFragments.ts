// backend/src/utils/sqlFragments.ts
/**
 * Reusable SQL fragments for common query patterns
 * This ensures consistency across all service-related queries
 */

/**
 * Subquery to fetch all affiliate groups linked to a service
 * Returns a JSON array of group objects or NULL if no groups linked
 *
 * Usage: Include this in your SELECT statement as a column
 * Example: SELECT s.*, ${SERVICE_GROUPS_SUBQUERY} FROM shop_services s
 */
export const SERVICE_GROUPS_SUBQUERY = `
  (
    SELECT json_agg(json_build_object(
      'groupId', sga.group_id,
      'groupName', asg.group_name,
      'customTokenSymbol', asg.custom_token_symbol,
      'customTokenName', asg.custom_token_name,
      'icon', asg.icon,
      'tokenRewardPercentage', sga.token_reward_percentage,
      'bonusMultiplier', sga.bonus_multiplier
    ))
    FROM service_group_availability sga
    JOIN affiliate_shop_groups asg ON sga.group_id = asg.group_id
    WHERE sga.service_id = s.service_id AND sga.active = true
  ) as groups
`;

/**
 * Common service fields selection
 * Use this to ensure consistent field selection across all service queries
 */
export const SERVICE_BASE_FIELDS = `
  s.service_id,
  s.shop_id,
  s.service_name,
  s.description,
  s.price_usd,
  s.duration_minutes,
  s.category,
  s.image_url,
  s.tags,
  s.active,
  s.average_rating,
  s.review_count,
  s.created_at,
  s.updated_at
`;

/**
 * Common shop fields selection for service queries
 * Use this when joining shop_services with shops table
 */
export const SHOP_INFO_FIELDS = `
  sh.shop_id,
  sh.name as company_name,
  sh.name as shop_name,
  sh.address as shop_address,
  sh.location_city as shop_city,
  sh.country as shop_country,
  sh.phone as shop_phone,
  sh.email as shop_email,
  sh.verified as shop_is_verified,
  sh.location_lat,
  sh.location_lng,
  sh.location_city,
  sh.location_state,
  sh.location_zip_code
`;

/**
 * Full service query fields (service + shop + groups)
 * This is the most complete selection for customer-facing service queries
 */
export const FULL_SERVICE_FIELDS = `
  ${SERVICE_BASE_FIELDS},
  ${SHOP_INFO_FIELDS},
  ${SERVICE_GROUPS_SUBQUERY}
`;

/**
 * Shop location subquery for distance calculations
 * Returns shop location as a JSON object
 */
export const SHOP_LOCATION_SUBQUERY = `
  json_build_object(
    'lat', sh.location_lat,
    'lng', sh.location_lng,
    'city', sh.location_city,
    'state', sh.location_state,
    'zipCode', sh.location_zip_code
  ) as shop_location
`;
