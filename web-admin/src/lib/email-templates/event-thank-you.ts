/**
 * EVENT_THANK_YOU — post-event thank-you email for ticket holders / attendees,
 * with a feedback survey link. Styled after the Season 06 "The Right Time"
 * key visual: deep night-sky black, neon spectrum ribbons, white editorial type.
 *
 * Neon is layered for email-client support:
 *  - inline: colours, gradients, text-shadow / box-shadow glows (static look everywhere)
 *  - <style>: CSS keyframe motion (ribbon flow, flicker, pulse). Email clients never run
 *    JavaScript, so animation libraries like GSAP can't be used; CSS animation plays in
 *    Apple Mail / iOS Mail and is ignored elsewhere. Disabled for prefers-reduced-motion.
 *
 * Typeface: Be Vietnam Pro (web font, renders in Apple Mail / iOS / Outlook.com / Samsung).
 * Gmail and Outlook desktop don't load web fonts and fall back to Helvetica / Arial.
 *
 * Variables (Mustache, rendered via replaceVariables):
 *  {{customerName}}
 */

export const EVENT_THANK_YOU_SUBJECT =
  'Thank you for being part of THE RIGHT TIME — TEDxFPTUniversityHCMC'

export const EVENT_THANK_YOU_VARIABLES = ['customerName']

export const EVENT_THANK_YOU_SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSduwn4d91mHfiOzvUxV6iZNdiOIMHblFPAcE3SvAk6UkEa6LA/viewform'

// Key-visual lettering cut from the Season 06 poster (source files in web-client/public/email/),
// hosted on the project's Cloudinary so it loads in every inbox.
const ASSET_BASE_URL = 'https://res.cloudinary.com/dug62fhtq/image/upload/tedx-fptuhcmc/email'

const FONT = `'Be Vietnam Pro','Helvetica Neue',Helvetica,Arial,sans-serif`

// Neon spectrum from the key visual. Starts and ends on lime so it tiles
// seamlessly when animated at background-size 200%.
const SPECTRUM =
  'linear-gradient(90deg,#b6ff3b 0%,#3dff8f 18%,#18e0ff 36%,#2f5bff 54%,#a13bff 70%,#ff3bd4 84%,#b6ff3b 100%)'

const GLOW_GREEN = '0 0 6px rgba(61,255,143,0.9),0 0 18px rgba(61,255,143,0.55)'
const GLOW_CYAN = '0 0 6px rgba(24,224,255,0.9),0 0 18px rgba(24,224,255,0.55)'

export const EVENT_THANK_YOU_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Thank you — THE RIGHT TIME</title>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,600;0,700;0,800;1,400&amp;display=swap" rel="stylesheet">
  <style type="text/css">
    .neon-title { filter: drop-shadow(0 0 4px rgba(255,255,255,0.55)) drop-shadow(0 0 14px rgba(24,224,255,0.45)) drop-shadow(0 0 32px rgba(161,59,255,0.4)); }
    @media (prefers-reduced-motion: no-preference) {
      .neon-ribbon { background-size: 200% 100% !important; animation: ribbonFlow 6s linear infinite; }
      .neon-flicker { animation: neonFlicker 5s linear infinite; }
      .neon-pulse { animation: neonPulse 2.4s ease-in-out infinite; }
      .neon-title { animation: titleGlow 4s ease-in-out infinite; }
      .neon-frame { animation: frameGlow 4s ease-in-out infinite; }
    }
    @keyframes ribbonFlow { from { background-position: 0% 50%; } to { background-position: 200% 50%; } }
    @keyframes neonFlicker {
      0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; }
      20%, 24%, 55% { opacity: 0.35; }
    }
    @keyframes neonPulse {
      0%, 100% { box-shadow: 0 0 8px rgba(61,255,143,0.7), 0 0 22px rgba(61,255,143,0.35); }
      50% { box-shadow: 0 0 14px rgba(61,255,143,1), 0 0 40px rgba(24,224,255,0.6), 0 0 70px rgba(24,224,255,0.3); }
    }
    @keyframes titleGlow {
      0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)) drop-shadow(0 0 14px rgba(24,224,255,0.4)) drop-shadow(0 0 30px rgba(161,59,255,0.35)); }
      50% { filter: drop-shadow(0 0 6px rgba(255,255,255,0.75)) drop-shadow(0 0 22px rgba(61,255,143,0.55)) drop-shadow(0 0 44px rgba(255,59,212,0.45)); }
    }
    @keyframes frameGlow {
      0%, 100% { box-shadow: 0 0 18px rgba(24,224,255,0.35), 0 0 48px rgba(161,59,255,0.25); }
      50% { box-shadow: 0 0 26px rgba(61,255,143,0.45), 0 0 64px rgba(255,59,212,0.3); }
    }
  </style>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1 {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#05060b;font-family:${FONT};-webkit-font-smoothing:antialiased;">

  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#05060b;">
    Thank you for being part of Season&nbsp;06. Share your thoughts in a quick 3-minute survey.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#05060b" style="background-color:#05060b;">
    <tr>
      <td align="center" style="padding:32px 16px;font-family:${FONT};">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#0a0b12" style="max-width:600px;width:100%;background-color:#0a0b12;border-radius:16px;overflow:hidden;box-shadow:0 0 40px rgba(24,224,255,0.18),0 0 90px rgba(161,59,255,0.14);">

          <!-- Top neon ribbon -->
          <tr>
            <td class="neon-ribbon" height="6" bgcolor="#3dff8f" style="height:6px;line-height:6px;font-size:0;background-color:#3dff8f;background-image:${SPECTRUM};">&nbsp;</td>
          </tr>

          <!-- HERO -->
          <tr>
            <td align="center" bgcolor="#0a0b12" style="padding:48px 32px 44px;background-color:#0a0b12;background-image:radial-gradient(circle at 0% 0%,rgba(61,255,143,0.38) 0%,rgba(10,11,18,0) 45%),radial-gradient(circle at 100% 100%,rgba(161,59,255,0.42) 0%,rgba(10,11,18,0) 50%),radial-gradient(circle at 100% 0%,rgba(24,224,255,0.24) 0%,rgba(10,11,18,0) 42%),radial-gradient(circle at 0% 100%,rgba(255,59,212,0.18) 0%,rgba(10,11,18,0) 40%);">

              <!-- TEDx lockup (TED wordmark keeps Helvetica/Arial: it mimics the official logo) -->
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:26px;line-height:1;font-weight:900;color:#e62b1e;letter-spacing:-0.5px;">
                TED<sup style="font-size:14px;font-weight:900;color:#e62b1e;">x</sup>
              </p>
              <p style="margin:6px 0 0;font-family:${FONT};font-size:15px;line-height:1.2;font-weight:300;color:#ffffff;letter-spacing:0.3px;">
                FPT University HCMC
              </p>
              <p style="margin:4px 0 0;font-family:${FONT};font-size:9px;line-height:1.2;color:#b8bcc8;">
                <span style="color:#e62b1e;font-weight:700;">x</span> = independently organized TED event
              </p>

              <!-- THE RIGHT TIME (image: the script lettering can't be reproduced with web fonts in Gmail/Outlook) -->
              <img class="neon-title" src="${ASSET_BASE_URL}/the-right-time-title.png" width="440" alt="THE RIGHT TIME" style="display:block;margin:40px auto 0;width:100%;max-width:440px;height:auto;border:0;outline:none;text-decoration:none;color:#ffffff;font-family:${FONT};font-size:44px;font-weight:300;letter-spacing:4px;line-height:1.1;">

              <!-- Season 06 -->
              <img src="${ASSET_BASE_URL}/season-06.png" width="150" alt="SEASON 06." style="display:block;margin:32px auto 0;width:150px;max-width:150px;height:auto;border:0;outline:none;text-decoration:none;color:#ffffff;font-family:${FONT};font-size:22px;font-weight:800;line-height:1.1;">
            </td>
          </tr>

          <!-- Glowing spectrum divider -->
          <tr>
            <td style="padding:0 32px;">
              <div class="neon-ribbon" style="height:2px;line-height:2px;font-size:0;background-color:#18e0ff;background-image:${SPECTRUM};box-shadow:0 0 10px rgba(24,224,255,0.8),0 0 24px rgba(161,59,255,0.5);">&nbsp;</div>
            </td>
          </tr>

          <!-- THANK YOU MESSAGE -->
          <tr>
            <td style="padding:40px 40px 8px;font-family:${FONT};">
              <p class="neon-flicker" style="margin:0 0 12px;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:700;color:#3dff8f;letter-spacing:3px;text-transform:uppercase;text-shadow:${GLOW_GREEN};">
                Thank you
              </p>
              <p style="margin:0 0 24px;font-family:${FONT};font-size:26px;line-height:1.35;font-weight:300;color:#ffffff;letter-spacing:-0.2px;">
                Thank you, <strong style="font-weight:700;color:#b6ff3b;text-shadow:${GLOW_GREEN};">{{customerName}}</strong>&nbsp;&mdash;<br>you arrived at the right&nbsp;time.
              </p>
              <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.7;font-weight:400;color:#c9ccd6;">
                Being there at <strong style="font-weight:600;color:#ffffff;">THE RIGHT TIME</strong> helped make Season&nbsp;06 truly unforgettable. Every round of applause, every attentive moment and every conversation after the talks reminds us why we keep sharing ideas worth&nbsp;spreading.
              </p>
              <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.7;font-weight:400;color:#c9ccd6;">
                We hope you left with a new story, a fresh perspective&nbsp;&mdash; or simply the feeling that <em style="font-style:italic;color:#ffffff;">now is the right time</em> to begin something&nbsp;new.
              </p>
            </td>
          </tr>

          <!-- SURVEY CARD -->
          <tr>
            <td style="padding:36px 40px 8px;">
              <table class="neon-frame neon-ribbon" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#3dff8f" style="background-color:#3dff8f;background-image:${SPECTRUM};border-radius:14px;box-shadow:0 0 18px rgba(24,224,255,0.35),0 0 48px rgba(161,59,255,0.25);">
                <tr>
                  <td style="padding:2px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#10121c" style="background-color:#10121c;background-image:radial-gradient(circle at 50% 0%,rgba(24,224,255,0.12) 0%,rgba(16,18,28,0) 60%);border-radius:12px;">
                      <tr>
                        <td align="center" style="padding:34px 28px;font-family:${FONT};">
                          <p class="neon-flicker" style="margin:0 0 12px;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:700;color:#18e0ff;letter-spacing:3px;text-transform:uppercase;text-shadow:${GLOW_CYAN};">
                            Your voice matters
                          </p>
                          <p style="margin:0 0 12px;font-family:${FONT};font-size:21px;line-height:1.35;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">
                            Tell us about your experience
                          </p>
                          <p style="margin:0 0 26px;font-family:${FONT};font-size:14px;line-height:1.6;font-weight:400;color:#b8bcc8;">
                            It takes about 3&nbsp;minutes. Your feedback helps us make the next season of TEDxFPTUniversityHCMC even&nbsp;better.
                          </p>
                          <!--[if mso]>
                          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${EVENT_THANK_YOU_SURVEY_URL}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="50%" stroke="f" fillcolor="#3dff8f">
                            <center style="color:#05060b;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:2px;">TAKE THE SURVEY</center>
                          </v:roundrect>
                          <![endif]-->
                          <!--[if !mso]><!-->
                          <a class="neon-pulse" href="${EVENT_THANK_YOU_SURVEY_URL}" target="_blank" style="display:inline-block;background-color:#3dff8f;background-image:linear-gradient(90deg,#b6ff3b 0%,#3dff8f 50%,#18e0ff 100%);color:#05060b;padding:17px 44px;font-family:${FONT};font-size:14px;line-height:1;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;border-radius:999px;box-shadow:0 0 10px rgba(61,255,143,0.8),0 0 28px rgba(24,224,255,0.45);">
                            Take the survey&nbsp;&rarr;
                          </a>
                          <!--<![endif]-->
                          <p style="margin:20px 0 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#7d8292;word-break:break-all;">
                            Or open this link: <a href="${EVENT_THANK_YOU_SURVEY_URL}" target="_blank" style="color:#18e0ff;text-decoration:underline;">${EVENT_THANK_YOU_SURVEY_URL}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding:36px 40px 40px;font-family:${FONT};">
              <p style="margin:0 0 4px;font-family:${FONT};font-size:15px;line-height:1.7;font-weight:400;color:#c9ccd6;">
                See you next season!
              </p>
              <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.7;color:#ffffff;font-weight:700;">
                The TEDxFPTUniversityHCMC Organizing&nbsp;Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" bgcolor="#07080d" style="padding:28px 32px;background-color:#07080d;border-top:1px solid #1b1e2b;font-family:${FONT};">
              <p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:1.5;color:#7d8292;">
                Need help? <a href="mailto:support@tedxfptuhcm.com" style="color:#18e0ff;text-decoration:none;text-shadow:0 0 8px rgba(24,224,255,0.6);">support@tedxfptuhcm.com</a>
              </p>
              <p style="margin:0;font-family:${FONT};font-size:10px;line-height:1.6;color:#5b6070;">
                &copy; 2026 TEDxFPTUniversityHCMC. All rights reserved.<br>
                This independent TEDx event is operated under license from&nbsp;TED.
              </p>
            </td>
          </tr>

          <!-- Bottom neon ribbon -->
          <tr>
            <td class="neon-ribbon" height="6" bgcolor="#a13bff" style="height:6px;line-height:6px;font-size:0;background-color:#a13bff;background-image:${SPECTRUM};">&nbsp;</td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

export const EVENT_THANK_YOU_TEXT = `Thank you, {{customerName}} — you arrived at the right time.

Being there at THE RIGHT TIME helped make TEDxFPTUniversityHCMC Season 06 truly unforgettable.

Tell us about your experience (about 3 minutes): ${EVENT_THANK_YOU_SURVEY_URL}

See you next season!
The TEDxFPTUniversityHCMC Organizing Team
Need help? support@tedxfptuhcm.com`
