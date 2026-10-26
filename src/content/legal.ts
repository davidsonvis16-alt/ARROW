/**
 * ARROW's Terms of Service, Privacy Policy, Safety Guidelines and Community
 * Guidelines.
 *
 * Written to Kenyan law (Data Protection Act 2019, Consumer Protection Act
 * 2012, Computer Misuse and Cybercrimes Act 2018). This is a strong starting
 * draft, not legal advice: have a Kenyan advocate review it before launch, and
 * fill in every value in LEGAL_CONTACT — a policy that names no one to contact
 * does not meet the Act's transparency requirements.
 */

export const LEGAL_CONTACT = {
  /** The person or registered business that runs ARROW and controls the data. */
  operator: 'Eden',
  /** TODO before launch: registered business name, if different from the above. */
  registeredName: '[registered business name]',
  /** TODO before launch: postal or physical address in Kenya. */
  address: '[postal address, Nairobi, Kenya]',
  /** TODO before launch: a monitored inbox for privacy and safety requests. */
  email: '[support email address]',
  /** TODO before launch: ODPC registration number once registered as a data controller. */
  odpcRegistration: '[ODPC registration number]',
  lastUpdated: '26 October 2026',
};

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  intro: string;
  sections: LegalSection[];
}

const C = LEGAL_CONTACT;

export const TERMS: LegalDocument = {
  title: 'Terms of Service',
  intro: `These Terms are a binding agreement between you and ${C.operator} (${C.registeredName}), who created and operates ARROW. By creating an account or using ARROW you accept them in full. If you do not agree, do not use ARROW. Please read section 4 carefully: we enforce it strictly and without warning.`,
  sections: [
    {
      heading: '1. Who may use ARROW',
      bullets: [
        'You must be at least 18 years old. We verify age when you sign up and remove any account we believe belongs to a minor, immediately and permanently.',
        'You must be legally able to enter a contract under Kenyan law and not barred from using services like ARROW by any law or court order.',
        'You must not have been convicted of, or be required to register for, any sexual offence or offence involving violence, in Kenya or anywhere else.',
        'You may hold one account only, and only for yourself. Accounts may not be shared, sold, transferred or run on someone else\'s behalf.',
        'If we have previously removed your account, you may not create another one.',
      ],
    },
    {
      heading: '2. Your account',
      bullets: [
        'Everything on your profile must be true and about you: your real first name, your real age and gender, and recent photos in which you are clearly recognisable.',
        'Keep your login details secret. You are responsible for everything done through your account until you tell us it has been compromised.',
        'Tell us at once if you believe someone else has accessed your account.',
      ],
    },
    {
      heading: '3. Photos and content you post',
      bullets: [
        'You may only upload photos you took or have the right to use, and only of yourself. Your main photo must show your face, with you alone.',
        'No nudity, partial nudity, sexual poses, underwear or swimwear shots that are sexual in nature, or images of sexual acts.',
        'No photos of children, even your own. No photos of other adults without their consent.',
        'No violence, weapons, drugs, hate symbols, contact details, social media handles, QR codes or advertising in photos or text.',
        'You keep ownership of what you post. You give us a worldwide, non-exclusive, royalty-free licence to store, display, resize and show it to other members as part of operating ARROW, for as long as it is on ARROW.',
        'We may remove any photo or text that we believe breaks these Terms, without notice.',
      ],
    },
    {
      heading: '4. Strictly prohibited — zero tolerance',
      paragraphs: [
        'Any of the following leads to permanent removal of your account without warning and without refund. Where the law requires it, or where someone may be in danger, we report it to the National Police Service, the Directorate of Criminal Investigations or other competent authorities, and we preserve evidence for them.',
      ],
      bullets: [
        'Any contact with, or content involving, a person under 18, or any attempt to sexualise a minor.',
        'Harassment, stalking, bullying, threats, intimidation, or continuing to contact someone who has stopped responding, unmatched or blocked you — on ARROW or anywhere else.',
        'Sending unsolicited sexual messages or images.',
        'Hate speech or discrimination based on race, tribe, ethnicity, religion, nationality, disability, gender, sexual orientation or any other protected characteristic.',
        'Asking any member for money, gifts, airtime, M-Pesa transfers, cryptocurrency, investments, loans, bank or card details — for any reason. Romance scams are crimes under the Computer Misuse and Cybercrimes Act 2018 and are reported.',
        'Offering, requesting or advertising sex work, escort services, "sugar" arrangements or any paid companionship.',
        'Impersonating anyone, using someone else\'s photos, catfishing, creating fake or duplicate profiles, or misrepresenting your age, identity, relationship status or intentions.',
        'Recording, screenshotting or sharing another member\'s photos, messages or personal details outside ARROW without their consent, or publishing anyone\'s private information (doxxing).',
        'Selling, promoting or soliciting anything: products, services, events, other apps, websites, social media accounts or pyramid schemes.',
        'Using bots, scripts, scrapers or automation of any kind; collecting other members\' data; or interfering with, probing, overloading or attacking ARROW\'s systems.',
        'Getting around any limit, paywall, block, ban, age check or security control, or reverse engineering the service.',
        'Any illegal activity, including involving drugs, weapons or violence, or encouraging self-harm.',
      ],
    },
    {
      heading: '5. Meeting people — your responsibility',
      bullets: [
        'ARROW does not run criminal background checks or verify identity beyond the checks described in our Privacy Policy. We cannot promise that any member is who they say they are.',
        'You alone are responsible for your interactions with other members, online and in person. Read our Safety Guidelines before meeting anyone.',
        'We are not responsible for the conduct of any member, on or off ARROW, except to the extent Kenyan law makes us responsible and cannot be excluded.',
      ],
    },
    {
      heading: '6. Moderation and enforcement',
      bullets: [
        'We may review reported accounts, profiles and messages to keep members safe. Messages in a reported conversation may be read by our safety team.',
        'We may, at our sole discretion and without notice, remove content, limit features, suspend or permanently ban any account we reasonably believe has broken these Terms or puts anyone at risk.',
        'Bans are permanent. Paid memberships on a banned account end immediately and are not refunded.',
        'If you think we got it wrong, write to us at the address in section 13 within 30 days and we will review the decision.',
      ],
    },
    {
      heading: '7. Memberships and payments',
      bullets: [
        'ARROW is free to use. ARROW Plus and ARROW Premium are optional paid memberships that add features; they never add safety tools, which are free for everyone.',
        'Prices are shown in Kenyan shillings (KES) in the app before you pay, and again on the payment page.',
        'Card memberships renew automatically every month at the price shown when you subscribed, charged to the same card, until you cancel.',
        'M-Pesa payments buy 30 days of the chosen plan and never renew automatically. Paying again adds 30 days to the end of a running pass for the same plan; paying for a different plan starts that plan immediately and replaces the remaining time.',
        'You can cancel a card membership at any time in Settings → Membership. Cancelling stops the next renewal; you keep your features until the end of the period already paid for.',
        'If a renewal payment fails, your plan stays active while the payment is retried, and ends if it cannot be collected.',
        'Payments are non-refundable, including for unused time, except where the Consumer Protection Act 2012 or other Kenyan law gives you a right to a refund.',
        'Each account may start one free trial, once. Creating accounts to obtain more trials is prohibited.',
        'We may change membership prices or features. Price changes apply from your next renewal and we will tell you at least 30 days beforehand, so you can cancel first.',
        'Payments are processed by Paystack. ARROW never receives or stores your card number or M-Pesa PIN.',
      ],
    },
    {
      heading: '8. Third-party services',
      paragraphs: [
        'You may sign in with Google, pay through Paystack (including M-Pesa), or move a conversation to WhatsApp after matching. Those services are governed by their own terms and privacy policies, and we are not responsible for them. Once you share your number or move to another app, ARROW\'s safety tools no longer protect that conversation.',
      ],
    },
    {
      heading: '9. Our service',
      bullets: [
        'ARROW, its name, logo, design and software belong to Eden. You may not copy, modify, or reuse them without written permission.',
        'We provide ARROW "as is" and "as available". We do not guarantee that it will be uninterrupted, error-free, or that you will find a match.',
        'We may change, suspend or discontinue any part of ARROW. If we close ARROW entirely, we will give at least 30 days\' notice and refund any unused, prepaid membership time.',
      ],
    },
    {
      heading: '10. Liability',
      paragraphs: [
        'To the fullest extent permitted by Kenyan law, Eden is not liable for any indirect, incidental, special or consequential loss, or for loss of profits, data or goodwill, arising from your use of ARROW or from the conduct of any member. Our total liability to you for any claim is limited to the amount you paid us in the 12 months before the claim, or KES 5,000 if you paid nothing. Nothing in these Terms limits liability for death or personal injury caused by our negligence, for fraud, or any other liability that cannot be limited under Kenyan law, and nothing affects your statutory rights as a consumer.',
      ],
    },
    {
      heading: '11. Indemnity',
      paragraphs: [
        'You agree to compensate Eden for any claim, loss or expense (including reasonable legal fees) arising from your breach of these Terms, your content, or your conduct towards other members.',
      ],
    },
    {
      heading: '12. Ending your account, changes, and governing law',
      bullets: [
        'You can delete your account at any time in Settings. If you have a paid membership, cancel it first.',
        'We may update these Terms. For material changes we will notify you in the app at least 14 days before they take effect; continuing to use ARROW after that means you accept them.',
        'These Terms are governed by the laws of the Republic of Kenya. Before going to court, contact us so we can try to resolve the issue informally within 30 days. Any dispute that is not resolved will be decided by the courts of Kenya sitting in Nairobi.',
        'If any part of these Terms is found unenforceable, the rest remains in force.',
      ],
    },
    {
      heading: '13. Contact',
      paragraphs: [`${C.operator} — ${C.registeredName}, ${C.address}. Email: ${C.email}.`],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  intro: `This policy explains what personal data ARROW collects, why, who can see it, and the rights you have under the Kenya Data Protection Act, 2019. ${C.operator} (${C.registeredName}) is the data controller (ODPC registration: ${C.odpcRegistration}).`,
  sections: [
    {
      heading: '1. Data we collect',
      bullets: [
        'Account: your email address, and if you use Google sign-in, the basic profile Google shares (name and email).',
        'Profile: first name, gender, date of birth, the town or area you enter, bio, interests, what you are looking for, prompt answers and photos.',
        'Preferences: the age range, genders and location you want to see.',
        'Activity: the arrows you send and receive, passes, matches, messages, reactions, blocks and reports, and when you were last active.',
        'Optional: a WhatsApp number, only if you choose to share it with matches.',
        'Membership and payments: your plan, its status and renewal date, and for each payment the amount, currency, method (card or M-Pesa), date and Paystack\'s reference numbers. Paystack, not ARROW, holds your card details and M-Pesa number.',
        'Technical: IP address, device and browser type and error logs, kept by our hosting provider to run and secure the service.',
      ],
    },
    {
      heading: '2. Sensitive personal data',
      paragraphs: [
        'Your gender, the genders you are interested in, and your use of a dating service can reveal your sex and sexual orientation, which the Data Protection Act treats as sensitive personal data. We process it only with your explicit consent, which you give by entering it, and only to show you relevant people and show you to them. You can withdraw consent at any time by deleting your account.',
      ],
    },
    {
      heading: '3. What we never do',
      bullets: [
        'We never sell your personal data or share it with advertisers. ARROW shows no ads.',
        'We never collect your precise GPS location. Photos are resized on your device before upload, which strips hidden metadata such as the location a photo was taken.',
        'We never show your date of birth to other members — only your age.',
        'We never show your WhatsApp number to anyone except a confirmed match, and only while you have sharing turned on.',
      ],
    },
    {
      heading: '4. Why we use your data, and our legal basis',
      bullets: [
        'To provide ARROW — your profile, discovery, matching and messaging (performance of our contract with you).',
        'To verify you are an adult and keep members safe — age checks, moderation of reports, preventing fraud and abuse, and enforcing our Terms (legitimate interests, and legal obligation).',
        'To process memberships and keep payment records (contract, and legal obligation under Kenyan tax law).',
        'To use sensitive personal data described in section 2 (your explicit consent).',
        'To meet legal obligations and respond to lawful requests from Kenyan authorities.',
      ],
    },
    {
      heading: '5. Who can see your data',
      bullets: [
        'Other members see your public profile (name, age, gender, area, bio, interests, prompts, photos, and recent activity unless you hide it) — only when ARROW\'s rules allow, such as when you appear in their discovery or have matched. Blocked members cannot see you at all.',
        'Messages are visible only to the two people in the match, and to our safety team if the conversation is reported.',
        'Service providers who process data for us under contract and only on our instructions: Supabase (database, file storage and login), Paystack (payments, including M-Pesa) and Google (if you sign in with Google).',
        'Authorities, where Kenyan law requires it or where we believe in good faith that disclosure is necessary to prevent harm to someone.',
      ],
    },
    {
      heading: '6. Transfers outside Kenya',
      paragraphs: [
        'Our providers may store or process data on servers outside Kenya. Where they do, we rely on their contractual data protection commitments and security safeguards, as required by sections 48 to 50 of the Data Protection Act, and we choose providers that meet internationally recognised security standards.',
      ],
    },
    {
      heading: '7. How long we keep it',
      bullets: [
        'Your profile, photos, matches and messages are deleted from our live systems when you delete your account. Backup copies expire within 30 days.',
        'When someone unmatches or blocks, the conversation between those two members is deleted.',
        'Reports you made, and reports about you, are deleted with your account. A report already passed to the authorities is kept for as long as they need it.',
        'Payment records are kept for as long as Kenyan tax law requires.',
      ],
    },
    {
      heading: '8. How we protect it',
      bullets: [
        'All traffic to ARROW is encrypted in transit (HTTPS), and our database and file storage are encrypted at rest by our hosting provider.',
        'Access rules are enforced inside the database itself, so one member cannot read another member\'s private data even by manipulating the app.',
        'Photos are stored privately and shown through links that expire after an hour.',
        'If a personal data breach puts your rights at risk, we will notify the Data Commissioner within 72 hours and tell you without undue delay, as the Act requires.',
      ],
    },
    {
      heading: '9. Your rights',
      paragraphs: ['Under section 26 and related sections of the Data Protection Act, 2019, you have the right to:'],
      bullets: [
        'be informed of how your data is used (this policy);',
        'access the personal data we hold about you;',
        'correct inaccurate data — most of it you can edit yourself in the app;',
        'delete your data — use Delete account in Settings, or write to us;',
        'object to processing, and withdraw consent at any time;',
        'receive your data in a portable format;',
        'complain to the Office of the Data Protection Commissioner (www.odpc.go.ke) if you are unhappy with how we handle your data.',
      ],
    },
    {
      heading: '10. Age limit',
      paragraphs: [
        'ARROW is only for adults aged 18 and over. We do not knowingly collect data from anyone under 18. If we learn that we have, we delete the account and its data immediately. If you believe a minor is using ARROW, report the profile in the app or email us.',
      ],
    },
    {
      heading: '11. Automated decisions',
      paragraphs: [
        'The order in which profiles appear in discovery is decided automatically, using your preferences, who has liked you, membership boosts and recent activity. No automated decision produces legal effects about you; account removals are made or reviewed by a person.',
      ],
    },
    {
      heading: '12. Changes and contact',
      paragraphs: [
        'We will tell you in the app before any material change to this policy takes effect.',
        `To exercise your rights or ask a question, contact ${C.operator} at ${C.email} or ${C.address}. We respond within the time limits set by the Data Protection Act.`,
      ],
    },
  ],
};

export const SAFETY: LegalDocument = {
  title: 'Safety Guidelines',
  intro: 'Most people on ARROW are here for the same reason you are. These habits keep it that way.',
  sections: [
    {
      heading: 'Before you meet',
      bullets: [
        'Talk in ARROW first. You do not have to share your number, social media or workplace until you are ready.',
        'Never send money, M-Pesa, airtime or gifts to someone you have not met — whatever the story. Report anyone who asks.',
        'Do a video call before meeting. Someone who keeps avoiding one may not be who they say.',
      ],
    },
    {
      heading: 'When you meet',
      bullets: [
        'Meet in a busy public place, and get there and home by yourself.',
        'Tell a friend where you are going, who with, and when you expect to be back.',
        'Stay in control of your drink and your phone. Leave whenever you want to — you never owe anyone your time.',
      ],
    },
    {
      heading: 'If something is wrong',
      bullets: [
        'Use Report on their profile or in the chat. Reporting also blocks them instantly, and they are never told who reported them.',
        'If you are in danger, call 999, 112 or 911. For gender-based violence support, call the free national helpline 1195.',
      ],
    },
  ],
};

export const GUIDELINES: LegalDocument = {
  title: 'Community Guidelines',
  intro: 'The short version of our Terms: be real, be kind, take no for an answer.',
  sections: [
    {
      heading: 'Be real',
      bullets: [
        'Use your own name, age and recent photos of you alone.',
        'Say honestly what you are looking for.',
      ],
    },
    {
      heading: 'Be kind',
      bullets: [
        'Treat matches the way you would want a friend treated. No insults, pressure or explicit messages nobody asked for.',
        'An unmatch, a block or no reply is an answer. Do not try to contact them another way.',
      ],
    },
    {
      heading: 'Keep it personal, not commercial',
      bullets: [
        'No selling, promoting, recruiting, or asking for money of any kind.',
        'No sex work, escort or "sugar" arrangements.',
      ],
    },
    {
      heading: 'Zero tolerance',
      paragraphs: [
        'Anything involving minors, threats, scams or sharing someone\'s private photos ends your account permanently and may be reported to the police. The full rules are in our Terms of Service.',
      ],
    },
  ],
};
