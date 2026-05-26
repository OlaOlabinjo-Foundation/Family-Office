/**
 * Force demo auth for API smoke tests even when the shell has FAMILY_OFFICE_AUTH=sqlite.
 */
delete process.env.FAMILY_OFFICE_AUTH;
delete process.env.FAMILY_OFFICE_USERS_JSON;
