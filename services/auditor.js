const axios = require('axios');

const PLATFORM_CRITERIA = {
  TikTok: `
- Hook must be in first 1-3 seconds, punchy and attention-grabbing
- Casual, energetic, trend-aware tone
- Short and fast-paced content (15-60 seconds ideal)
- Must have a strong CTA (follow, comment, visit link in bio)
- Penalize overly corporate or stiff language heavily
- CRM/automation must feel relatable, not technical`,

  Instagram: `
- Visual storytelling focus — script must complement visuals
- Aspirational and aesthetic tone
- Reels: 15-30 seconds, Stories: conversational
- CTA should drive saves, shares, or profile visits
- CRM mention should feel lifestyle-oriented
- Meta Ad Guidelines: no misleading claims, clear advertiser identity, no sensationalized language`,

  Facebook: `
- Longer form content acceptable (up to 3 minutes)
- Community and trust-building tone
- CTAs should drive clicks, shares, or event signups
- CRM mention can be more direct and business-focused
- Meta Ad Guidelines: no misleading claims, clear advertiser identity, no sensationalized language`,

  YouTube: `
- Hook in first 30 seconds is critical
- Educational, detailed, and value-driven content
- Longer scripts acceptable (3-15 minutes)
- Must have clear chapter structure or narrative arc
- CTA should drive subscriptions and comments
- CRM/automation explanation can be technical and detailed`,

  'X (Twitter)': `
- Extremely concise and punchy (under 60 seconds for video)
- Witty, bold, or contrarian tone performs best
- CTA should drive retweets, replies, or link clicks
- CRM mention should be framed as a hot take or insight`,

  LinkedIn: `
- Professional and thought-leadership tone
- Business ROI and results-focused language
- 1-3 minute videos ideal
- CTA should drive connections, DMs, or website visits
- CRM and automation should be framed as business growth tools
- Singapore business context is a plus`,
};

const PLATFORM_AD_GUIDELINES = {
  TikTok: `
TikTok Ads Policy Check:
- No misleading or false claims about products/services
- No exaggerated results or unrealistic promises
- Must clearly identify as branded/sponsored content
- No sensationalized language ("guaranteed", "instant results")
- Must comply with local Singapore advertising standards`,

  Instagram: `
Meta Ad Guidelines Check:
- No misleading claims or exaggerated results
- Must have clear advertiser identity (WiBiz must be identifiable)
- Financial or business claims must be accurate and substantiated
- No sensationalized language ("guaranteed", "100% success")
- CTA must be clear but not manipulative`,

  Facebook: `
Meta Ad Guidelines Check:
- No misleading claims or exaggerated results
- Must have clear advertiser identity (WiBiz must be identifiable)
- Financial or business claims must be accurate and substantiated
- No sensationalized language ("guaranteed", "100% success")
- CTA must be clear but not manipulative`,

  YouTube: `
Google Ads Policy Check:
- No misleading representations about WiBiz services
- No unrealistic performance claims
- Must clearly identify sponsored content
- Business claims must be substantiated
- Must comply with Singapore consumer protection laws`,

  'X (Twitter)': `
X Ads Policy Check:
- No misleading or deceptive claims
- Must clearly disclose sponsored/promotional content
- No manipulation or artificial urgency tactics
- Business claims must be accurate and verifiable`,

  LinkedIn: `
LinkedIn Ads Policy Check:
- No false or misleading professional claims
- Must accurately represent WiBiz services and capabilities
- No exaggerated ROI or business outcome promises
- Clear identification of WiBiz as the advertiser`,
};

const getAdField = (platform) => {
  const map = {
    TikTok: 'tiktok_ad_compliant',
    Instagram: 'meta_ad_compliant',
    Facebook: 'meta_ad_compliant',
    YouTube: 'google_ad_compliant',
    'X (Twitter)': 'x_ad_compliant',
    LinkedIn: 'linkedin_ad_compliant',
  };
  return map[platform] || 'ad_compliant';
};

const getSystemPrompt = (platform) => {
  const adField = getAdField(platform);
  return `You are a senior brand strategist for WiBiz — a Singapore-based AI automation and CRM solutions company. Your job is to audit video transcripts against WiBiz brand standards for ${platform}.

WiBiz Brand Standards:
- Core Services: AI automation, CRM solutions, business process automation, lead generation
- Brand Voice: Professional yet approachable, forward-thinking, results-driven, Singapore market savvy
- Must Include: Clear value proposition, technology focus, CRM or automation mention

Platform-Specific Scoring Criteria for ${platform}:
${PLATFORM_CRITERIA[platform] || ''}

Ad Policy Compliance for ${platform}:
${PLATFORM_AD_GUIDELINES[platform] || ''}

General Criteria:
- Hook: First 3 seconds must grab attention
- CTA: Must have a clear call-to-action
- Brand Alignment: Content must match WiBiz voice and services

Return ONLY valid JSON (no markdown, no explanation):
{
  "platform": "${platform}",
  "brand_alignment": "Yes / No / Partially",
  "crm_mention": "Yes / No / Partially",
  "action": "Keep / Revise / Delete",
  "score": 0-100,
  "hook_strength": "Strong / Moderate / Weak",
  "cta_present": true or false,
  "verdict": "one sentence summary",
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "revised_angle": "A one paragraph suggested revision angle tailored for ${platform}",
  "${adField}": "Yes / No / Partially"
}`;
};

const auditBrand = async (transcript, platform) => {
  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 1000,
        temperature: 0,
        messages: [
          { role: 'system', content: getSystemPrompt(platform) },
          { role: 'user', content: `Audit this transcript for ${platform}:\n\n${transcript}` }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const raw = response.data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      throw new Error('AI returned invalid JSON — try again');
    }

  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error('Rate limit hit — wait 1 minute and try again');
    }
    throw new Error(`Brand audit failed: ${err.message}`);
  }
};

const auditByUrl = async (url, platform) => {
  try {
    const adField = getAdField(platform);
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        max_tokens: 1000,
        temperature: 0,
        messages: [
          { role: 'system', content: getSystemPrompt(platform) },
          {
            role: 'user',
            content: `Audit this ${platform} video based on its URL. You cannot access the video directly, but analyze what you can infer from the URL structure, platform context, and WiBiz brand standards. Provide your best assessment.

Video URL: ${url}
Platform: ${platform}

Important: Since direct video access is not available, base your audit on URL context and platform patterns. Flag in your verdict that this is a URL-based assessment.`
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const raw = response.data.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(clean);
    } catch {
      throw new Error('AI returned invalid JSON — try again');
    }

  } catch (err) {
    if (err.response?.status === 429) {
      throw new Error('Rate limit hit — wait 1 minute and try again');
    }
    throw new Error(`URL audit failed: ${err.message}`);
  }
};

module.exports = { auditBrand, auditByUrl };