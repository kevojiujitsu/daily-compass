// Only content explicitly submitted for sharing is checked; private journals are not read.
export function communityInput(body) {
  const action = String(body.action || '');
  if (!['post', 'comment', 'profile'].includes(action)) return null;
  if (body.moderationConsent !== true) throw new Error('Community sharing requires your permission for an OpenAI safety check. Update Daily Compass and try again.');
  const profile = body.profile || {};
  const text = action === 'profile'
    ? ['quote', 'hometown', 'relationship', 'spotify'].map(key => String(profile[key] || '')).join('\n').trim()
    : String(body.text || '').trim();
  const photo = String(action === 'profile' ? profile.avatar || '' : action === 'post' ? body.photo || '' : '');
  if (text.length > (action === 'comment' ? 500 : 1000)) throw new Error('That shared text is too long.');
  if (photo && (photo.length > 600_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(photo))) throw new Error('Choose a JPG, PNG, or WebP image smaller than 400 KB.');
  return {text, photo};
}

export async function checkCommunityContent(body, {apiKey, fetchImpl = fetch, displayName = ''} = {}) {
  const content = communityInput(body);
  if (!content || (!content.text && !content.photo)) return;
  if (!apiKey) throw new Error('Community safety checks are temporarily unavailable. Nothing was shared. Try again later.');
  const input = [];
  if (content.text || displayName) input.push({type: 'text', text: [displayName, content.text].filter(Boolean).join('\n')});
  if (content.photo) input.push({type: 'image_url', image_url: {url: content.photo}});
  let result;
  try {
    const response = await fetchImpl('https://api.openai.com/v1/moderations', {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`},
      body: JSON.stringify({model: 'omni-moderation-latest', input}), signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error('Unavailable');
    result = await response.json();
    if (!Array.isArray(result.results) || result.results.length === 0 || result.results.some(item => typeof item.flagged !== 'boolean')) throw new Error('Incomplete check');
  } catch {
    throw new Error('Community safety checks are temporarily unavailable. Nothing was shared. Try again later.');
  }
  if (result.results.some(item => item.flagged)) throw new Error('This content could not be shared under the Community Guidelines. Edit it or contact support if you think this is a mistake.');
}
