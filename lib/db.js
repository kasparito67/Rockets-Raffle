export async function db(path, {method = 'GET', body, headers = {}} = {}) {
  const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/' + path, {
    method, headers: {apikey:process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization:'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type':'application/json', ...headers},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
    signal:AbortSignal.timeout(10000), cache:'no-store'
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error('Database request failed');
    error.conflict = response.status === 409 || detail.includes('23505') || detail.includes('idempotency_conflict');
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
