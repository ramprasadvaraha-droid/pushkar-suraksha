"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Language = "en" | "te";

const translations: Record<string, string> = {
  "Language": "భాష",
  "Pushkaram · Andhra Pradesh": "పుష్కరాలు · ఆంధ్రప్రదేశ్",
  "Sign out": "సైన్ అవుట్",
  "Volunteer login": "వాలంటీర్ లాగిన్",
  "GODAVARI PUSHKARAM": "గోదావరి పుష్కరాలు",
  "FAMILY SAFETY RECORD": "కుటుంబ భద్రత రికార్డు",
  "FAMILY REGISTRATION": "కుటుంబ నమోదు",
  "Register your family": "మీ కుటుంబాన్ని నమోదు చేయండి",
  "Print the numbers on the slips and keep one with each family member.": "నంబర్లను స్లిప్‌లపై ముద్రించి, ప్రతి కుటుంబ సభ్యుడి దగ్గర ఒకటి ఉంచండి.",
  "Add each family member to create numbered slips.": "నంబర్లతో కూడిన స్లిప్‌లను రూపొందించడానికి ప్రతి కుటుంబ సభ్యుడిని జోడించండి.",
  "Secure family details are loading...": "కుటుంబ వివరాలు సురక్షితంగా లోడ్ అవుతున్నాయి...",
  "App setup needed": "యాప్ సెటప్ అవసరం",
  "Family sign-in": "కుటుంబ సభ్యుల సైన్ ఇన్",
  "Create your account": "మీ ఖాతాను సృష్టించండి",
  "Your name": "మీ పేరు",
  "Create account": "ఖాతా సృష్టించండి",
  "Already have an account? Sign in": "ఇప్పటికే ఖాతా ఉందా? సైన్ ఇన్ చేయండి",
  "New family? Create an account": "కొత్త కుటుంబమా? ఖాతా సృష్టించండి",
  "Verify your email": "మీ ఇమెయిల్‌ను ధృవీకరించండి",
  "Verify email": "ఇమెయిల్‌ను ధృవీకరించండి",
  "Check your email for a verification code or link.": "ధృవీకరణ కోడ్ లేదా లింక్ కోసం మీ ఇమెయిల్‌ను చూడండి.",
  "Email verified. Sign in with your password to continue.": "ఇమెయిల్ ధృవీకరించబడింది. కొనసాగడానికి మీ పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయండి.",
  "I clicked the verification link": "ధృవీకరణ లింక్‌ను తెరిచాను",
  "Back to sign in": "సైన్ ఇన్‌కు తిరిగి వెళ్లండి",
  "Could not create account. Please try again.": "ఖాతాను సృష్టించలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "Could not verify your email.": "మీ ఇమెయిల్‌ను ధృవీకరించలేకపోయాం.",
  "Could not restore your sign-in.": "మీ సైన్-ఇన్‌ను పునరుద్ధరించలేకపోయాం.",
  "Family details": "కుటుంబ వివరాలు",
  "Family information": "కుటుంబ సమాచారం",
  "Family name": "కుటుంబ పేరు",
  "Phone number": "ఫోన్ నంబర్",
  "10-digit India mobile": "10 అంకెల భారత మొబైల్ నంబర్",
  "Home district": "సొంత జిల్లా",
  "District": "జిల్లా",
  "Family members": "కుటుంబ సభ్యులు",
  "Give each person a unique number.": "ప్రతి ఒక్కరికీ ప్రత్యేక నంబర్ ఇవ్వండి.",
  "Member {number}": "సభ్యుడు {number}",
  "Remove": "తొలగించు",
  "Name": "పేరు",
  "Age": "వయస్సు",
  "Relation": "బంధుత్వం",
  "Gender": "లింగం",
  "Child photos · 4 required": "పిల్లల ఫోటోలు · 4 అవసరం",
  "Adult photo · 1 required": "పెద్దవారి ఫోటో · 1 అవసరం",
  "Face + full body + side + family photo": "ముఖం + పూర్తి శరీరం + పక్కవైపు + కుటుంబ ఫోటో",
  "Face close-up, clear photo": "ముఖం దగ్గరి ఫోటో, స్పష్టంగా",
  "Add family member": "కుటుంబ సభ్యుడిని చేర్చండి",
  "Secret verification": "రహస్య ధృవీకరణ",
  "Verify the parent before handing over a child.": "పిల్లవాడిని అప్పగించే ముందు తల్లిదండ్రులను ధృవీకరించండి.",
  "Only your family knows": "మీ కుటుంబానికి మాత్రమే తెలిసినది",
  "e.g. A birthmark on the left hand": "ఉదా. ఎడమ చేతిపై పుట్టుమచ్చ",
  "This secret is not printed on the slip. Only a hint is shown.": "ఈ రహస్యం స్లిప్‌పై ముద్రించబడదు. సూచన మాత్రమే కనిపిస్తుంది.",
  "After registration, you will receive a family number and a printable safety slip for each member.": "నమోదు తర్వాత కుటుంబ నంబర్ మరియు ప్రతి సభ్యునికి ముద్రించగల భద్రతా స్లిప్ లభిస్తాయి.",
  "Register family": "కుటుంబాన్ని నమోదు చేయండి",
  "Secure registration in progress...": "సురక్షిత నమోదు జరుగుతోంది...",
  "Valid 10-digit Indian mobile number required.": "చెల్లుబాటు అయ్యే 10 అంకెల భారతీయ మొబైల్ నంబర్ ఇవ్వండి.",
  "Secret must be at least 3 characters.": "రహస్యం కనీసం 3 అక్షరాలు ఉండాలి.",
  "Upload a {photo} photo for {member}.": "{member} కోసం {photo} ఫోటోను అప్‌లోడ్ చేయండి.",
  "Registration could not be completed.": "నమోదు పూర్తి కాలేదు.",
  "Private family photos could not be finalized.": "కుటుంబ ఫోటోలను భద్రపరచడం పూర్తి కాలేదు.",
  "Incomplete data may remain; contact the festival help desk.": "కొంత సమాచారం మిగిలి ఉండవచ్చు; పండుగ సహాయ కేంద్రాన్ని సంప్రదించండి.",
  "Incomplete data cleanup failed; contact the festival help desk.": "అసంపూర్ణ సమాచారం తొలగించలేకపోయాం; పండుగ సహాయ కేంద్రాన్ని సంప్రదించండి.",
  "Face front": "ముందు వైపు ముఖం",
  "Clear face, look straight at the camera": "ముఖం స్పష్టంగా ఉండాలి, కెమెరా వైపు నేరుగా చూడండి",
  "Face front close": "ముఖం దగ్గరి ఫోటో",
  "Face should be clear": "ముఖం స్పష్టంగా కనిపించాలి",
  "Full body": "పూర్తి శరీరం",
  "From head to feet": "తల నుంచి పాదాల వరకు",
  "Side photo": "పక్కవైపు ఫోటో",
  "From one side": "ఒక పక్క నుంచి",
  "With family": "కుటుంబంతో",
  "Together with family": "కుటుంబంతో కలిసి",
  "MISSING": "కనిపించడం లేదు",
  "Found": "కనుగొనబడింది",
  "Safe": "సురక్షితం",
  "Search": "వెతుకుతోంది",
  "Write on the hand": "చేతిపై రాయండి",
  "Your family number": "మీ కుటుంబ నంబర్",
  "Something went wrong. Please try again.": "ఏదో తప్పు జరిగింది. మళ్లీ ప్రయత్నించండి.",
  "Today's dress photo": "ఈరోజు దుస్తుల ఫోటో",
  "Upload today's outfit photo to help volunteers identify children.": "పిల్లలను గుర్తించడంలో వాలంటీర్లకు సహాయపడేందుకు ఈరోజు దుస్తుల ఫోటోను అప్‌లోడ్ చేయండి.",
  "No children have been added to your family. Add members in Family details.": "మీ కుటుంబంలో పిల్లలను చేర్చలేదు. కుటుంబ వివరాల్లో సభ్యులను చేర్చండి.",
  "Dress photo uploaded safely for {name}.": "{name} దుస్తుల ఫోటో సురక్షితంగా అప్‌లోడ్ అయింది.",
  "Photo upload failed.": "ఫోటో అప్‌లోడ్ కాలేదు.",
  "TODAY": "ఈరోజు",
  "Take a photo of what each child is wearing today.": "ప్రతి పిల్లవాడు ఈరోజు వేసుకున్న దుస్తుల ఫోటో తీయండి.",
  "Age {age}": "వయస్సు {age}",
  "Photo uploading...": "ఫోటో అప్‌లోడ్ అవుతోంది...",
  "Retake photo": "మళ్లీ ఫోటో తీయండి",
  "Take dress photo": "దుస్తుల ఫోటో తీయండి",
  "Make sure the photo is in focus and the child's face is visible.": "ఫోటో స్పష్టంగా ఉండాలి, పిల్లవాడి ముఖం కనిపించేలా చూసుకోండి.",
  "Volunteers alerted": "వాలంటీర్లకు సమాచారం అందింది",
  "Searching...": "వెతుకుతోంది...",
  "Volunteers have been alerted about {name}. Keep your phone nearby.": "{name} గురించి వాలంటీర్లకు సమాచారం అందింది. మీ ఫోన్ దగ్గర ఉంచుకోండి.",
  "Member number": "సభ్యుని నంబర్",
  "Missing report active": "తప్పిపోయిన వ్యక్తి నివేదిక సక్రియంగా ఉంది",
  "Stay calm. Show the number slip to volunteers and report here.": "ప్రశాంతంగా ఉండండి. నంబర్ స్లిప్‌ను వాలంటీర్లకు చూపించి ఇక్కడ నివేదించండి.",
  "Who is missing?": "ఎవరు కనిపించడం లేదు?",
  "Select member": "సభ్యుడిని ఎంచుకోండి",
  "Last seen ghat": "చివరిగా కనిపించిన ఘాట్",
  "Sending alert...": "అలర్ట్ పంపుతోంది...",
  "MISSING — Report missing": "కనిపించడం లేదు — నివేదించండి",
  "After reporting, the member number will appear on the volunteer dashboard.": "నివేదించిన తర్వాత సభ్యుని నంబర్ వాలంటీర్ డ్యాష్‌బోర్డ్‌లో కనిపిస్తుంది.",
  "Missing report could not be sent.": "తప్పిపోయిన వ్యక్తి నివేదిక పంపలేకపోయాం.",
  "Safe reunions": "సురక్షితంగా కలిసినవారు",
  "Found board · Names & phone numbers private": "కనుగొన్న వారి బోర్డు · పేర్లు, ఫోన్ నంబర్లు గోప్యం",
  "Board loading...": "బోర్డు లోడ్ అవుతోంది...",
  "No found reports yet. This board updates automatically.": "ఇంకా కనుగొన్న వారి నివేదికలు లేవు. ఈ బోర్డు ఆటోమేటిక్‌గా అప్‌డేట్ అవుతుంది.",
  "Retry": "మళ్లీ ప్రయత్నించండి",
  "Found board could not be loaded.": "కనుగొన్న వారి బోర్డు లోడ్ కాలేదు.",
  "safe at {ghat}": "{ghat} వద్ద సురక్షితంగా ఉన్నారు",
  "The public board shows only the number, photo and ghat. Names and phone numbers are private.": "పబ్లిక్ బోర్డులో నంబర్, ఫోటో, ఘాట్ మాత్రమే కనిపిస్తాయి. పేర్లు మరియు ఫోన్ నంబర్లు గోప్యం.",
  "REGISTERED": "నమోదైంది",
  "Your family has been registered safely": "మీ కుటుంబం సురక్షితంగా నమోదైంది",
  "Numbers ready!": "నంబర్లు సిద్ధం!",
  "Download slips": "స్లిప్‌లను డౌన్‌లోడ్ చేయండి",
  "Family number · Family no.": "కుటుంబ నంబర్",
  "Member slips": "సభ్యుల స్లిప్‌లు",
  "Select the number and last-seen ghat to alert volunteers.": "వాలంటీర్లకు సమాచారం ఇవ్వడానికి నంబర్ మరియు చివరిగా కనిపించిన ఘాట్‌ను ఎంచుకోండి.",
  "Only member number, photo and ghat are shared.": "సభ్యుని నంబర్, ఫోటో మరియు ఘాట్ మాత్రమే పంచుకుంటాం.",
  "Face photo of {name}": "{name} ముఖం ఫోటో",
  "Could not sign out. Please try again.": "సైన్ అవుట్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "Request could not be completed. Please try again.": "అభ్యర్థన పూర్తి కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "Found ghat for {number}": "{number} కనుగొన్న ఘాట్",
  "members": "సభ్యులు",
  "Upload dress photos for {count} children on Pushkar day.": "పుష్కరాల రోజున {count} మంది పిల్లల దుస్తుల ఫోటోలను అప్‌లోడ్ చేయండి.",
  "Family details are loading...": "కుటుంబ వివరాలు లోడ్ అవుతున్నాయి...",
  "Complete family registration first.": "ముందుగా కుటుంబ నమోదును పూర్తి చేయండి.",
  "Use the Family tab to sign in before managing photos.": "ఫోటోలను నిర్వహించడానికి ముందుగా Family ట్యాబ్‌లో సైన్ ఇన్ చేయండి.",
  "Register your family before reporting.": "నివేదించే ముందు మీ కుటుంబాన్ని నమోదు చేయండి.",
  "Use the Family tab to sign in before reporting a missing member.": "తప్పిపోయిన సభ్యుడిని నివేదించడానికి ముందుగా Family ట్యాబ్‌లో సైన్ ఇన్ చేయండి.",
  "Report not found for this number.": "ఈ నంబర్‌కు తప్పిపోయిన వ్యక్తి నివేదిక కనుగొనబడలేదు.",
  "No missing reports. Your family is safe.": "తప్పిపోయిన వారి నివేదికలు లేవు. మీ కుటుంబం సురక్షితంగా ఉంది.",
  "PUSHKAR DAY": "పుష్కరాల రోజు",
  "URGENT · FAMILY HELP": "అత్యవసరం · కుటుంబ సహాయం",
  "PUBLIC FOUND BOARD": "పబ్లిక్ కనుగొన్న వారి బోర్డు",
  "Main navigation": "ప్రధాన నావిగేషన్",
  "Family": "కుటుంబం",
  "Dress photo": "దుస్తుల ఫోటో",
  "Missing": "కనిపించడం లేదు",
  "Found board": "కనుగొన్న వారి బోర్డు",
  "Uploading photos securely...": "ఫోటోలు సురక్షితంగా అప్‌లోడ్ అవుతున్నాయి...",
  "Father": "తండ్రి",
  "Mother": "తల్లి",
  "Son": "కొడుకు",
  "Daughter": "కూతురు",
  "Other": "ఇతరులు",
  "Male": "పురుషుడు",
  "Female": "స్త్రీ",
  "JPEG, PNG, or WebP photos only.": "JPEG, PNG లేదా WebP ఫోటోలు మాత్రమే అప్‌లోడ్ చేయండి.",
  "Photo must be smaller than 10 MB.": "ఫోటో పరిమాణం 10 MB కంటే తక్కువగా ఉండాలి.",
  "Could not check the photo. Try another browser.": "ఫోటోను తనిఖీ చేయలేకపోయాం. వేరే బ్రౌజర్‌లో ప్రయత్నించండి.",
  "For face verification, use the latest Chrome browser.": "ముఖ ధృవీకరణ కోసం తాజా Chrome బ్రౌజర్‌ను ఉపయోగించండి.",
  "Face not visible. Please retake the photo.": "ముఖం కనిపించడం లేదు. దయచేసి మళ్లీ ఫోటో తీయండి.",
  "The photo is blurry. Please retake it.": "ఫోటో అస్పష్టంగా ఉంది. దయచేసి మళ్లీ తీయండి.",
  "Could not prepare the photo for printing.": "ప్రింటింగ్ కోసం ఫోటోను సిద్ధం చేయలేకపోయాం.",
  "Photo link expired. Refresh the family page and try again.": "ఫోటో లింక్ గడువు ముగిసింది. కుటుంబ పేజీని రిఫ్రెష్ చేసి మళ్లీ ప్రయత్నించండి.",
  "PDF could not be created.": "PDF సృష్టించలేకపోయాం.",
  "PDF is being prepared...": "PDF సిద్ధమవుతోంది...",
  "Member slip PDF": "సభ్యుని స్లిప్ PDF",
  "Search in progress": "వెతుకుతోంది",
  "Write on hand": "చేతిపై రాయండి",
  "Delete family photos": "కుటుంబ ఫోటోలను తొలగించండి",
  "Delete all {count} stored family photos, including today's dress photos. Family and member records will remain. Volunteers will no longer be able to use deleted photos to identify members. Photos are set to expire on September 30, 2027 at 11:59 PM IST.": "ఈరోజు దుస్తుల ఫోటోలతో సహా నిల్వ చేసిన {count} కుటుంబ ఫోటోలను తొలగించండి. కుటుంబం మరియు సభ్యుల వివరాలు అలాగే ఉంటాయి. తొలగించిన ఫోటోలతో వాలంటీర్లు సభ్యులను గుర్తించలేరు. ఫోటోలు 2027 సెప్టెంబర్ 30 రాత్రి 11:59 ISTకి గడువు ముగుస్తాయి.",
  "I understand this permanently removes the stored photos. It cannot remove copies already saved on a device.": "నిల్వ చేసిన ఫోటోలు శాశ్వతంగా తొలగుతాయని నాకు తెలుసు. పరికరంలో ఇప్పటికే సేవ్ చేసిన కాపీలను ఇది తొలగించదు.",
  "No family photos are currently stored.": "ప్రస్తుతం కుటుంబ ఫోటోలు ఏవీ నిల్వ చేయబడలేదు.",
  "Deleting photos...": "ఫోటోలు తొలగిస్తోంది...",
  "Delete all photos": "అన్ని ఫోటోలను తొలగించండి",
  "Photos could not be deleted. Please try again.": "ఫోటోలను తొలగించలేకపోయాం. దయచేసి మళ్లీ ప్రయత్నించండి.",
  "photo permanently deleted.": "ఫోటో శాశ్వతంగా తొలగించబడింది.",
  "{count} photos permanently deleted.": "{count} ఫోటోలు శాశ్వతంగా తొలగించబడ్డాయి.",
  "Volunteer Desk": "వాలంటీర్ డెస్క్",
  "Pushkar Suraksha · Seva": "పుష్కర సురక్ష · సేవ",
  "Logout": "లాగ్ అవుట్",
  "SEVA KENDRAM": "సేవా కేంద్రం",
  "Missing members": "కనిపించని సభ్యులు",
  "Checking volunteer session...": "వాలంటీర్ సెషన్‌ను తనిఖీ చేస్తోంది...",
  "Volunteer sign-in": "వాలంటీర్ సైన్ ఇన్",
  "Volunteer registration": "వాలంటీర్ నమోదు",
  "Register your name and mobile number. An organizer must approve your account before you can access missing-person reports.": "మీ పేరు, మొబైల్ నంబర్ నమోదు చేయండి. తప్పిపోయిన వారి నివేదికలను చూడటానికి నిర్వాహకుడి ఆమోదం అవసరం.",
  "Full name": "పూర్తి పేరు",
  "Mobile number": "మొబైల్ నంబర్",
  "Phone-verified account": "ఫోన్ ధృవీకరించిన ఖాతా",
  "Verified for sign-in": "సైన్-ఇన్ కోసం ధృవీకరించబడింది",
  "Verify your email address or mobile number before volunteer registration.": "వాలంటీర్ నమోదుకు ముందు మీ ఇమెయిల్ లేదా మొబైల్ నంబర్‌ను ధృవీకరించండి.",
  "Your verified sign-in account does not have an email address.": "మీ ధృవీకరించిన సైన్-ఇన్ ఖాతాలో ఇమెయిల్ చిరునామా లేదు.",
  "Your account must have a verified email or mobile number.": "మీ ఖాతాలో ధృవీకరించిన ఇమెయిల్ లేదా మొబైల్ నంబర్ ఉండాలి.",
  "Use the mobile number verified for your sign-in account.": "మీ సైన్-ఇన్ ఖాతాతో ధృవీకరించిన మొబైల్ నంబర్‌ను ఉపయోగించండి.",
  "Volunteer organizer emails are not configured. Contact the festival coordinator.": "వాలంటీర్ నిర్వాహకుల ఇమెయిల్‌లు సెటప్ చేయలేదు. పండుగ సమన్వయకర్తను సంప్రదించండి.",
  "Submitting...": "సమర్పిస్తోంది...",
  "Submit for organizer approval": "నిర్వాహకుడి ఆమోదానికి సమర్పించండి",
  "Registration received for {name}. The organizer must approve your account before you can view missing reports.": "{name} నమోదు అభ్యర్థన అందింది. తప్పిపోయిన వారి నివేదికలను చూడటానికి నిర్వాహకుడు మీ ఖాతాను ఆమోదించాలి.",
  "Your volunteer registration was not approved. You can submit an updated request below.": "మీ వాలంటీర్ నమోదు ఆమోదించబడలేదు. కింద సవరించిన అభ్యర్థనను సమర్పించవచ్చు.",
  "Update registration": "నమోదును సవరించండి",
  "Set or reset password for future sign-ins": "తదుపరి సైన్-ఇన్‌ల కోసం పాస్‌వర్డ్ సెట్ లేదా రీసెట్ చేయండి",
  "Verified family handovers": "ధృవీకరించిన కుటుంబ అప్పగింతలు",
  "Your verified handovers": "మీరు ధృవీకరించిన అప్పగింతలు",
  "Event total": "ఈవెంట్ మొత్తం",
  "Search by member number": "సభ్యుని నంబర్‌తో వెతకండి",
  "{count} active": "{count} సక్రియం",
  "Offline copy · Last synced list": "ఆఫ్‌లైన్ కాపీ · చివరిగా సింక్ చేసిన జాబితా",
  "Missing list loading...": "కనిపించని వారి జాబితా లోడ్ అవుతోంది...",
  "Handed over · Family reunited": "అప్పగించారు · కుటుంబం కలిసింది",
  "Parent: +91 {phone}": "తల్లిదండ్రులు: +91 {phone}",
  "Last seen: {ghat}": "చివరిగా కనిపించిన చోటు: {ghat}",
  "Guardian verification secret": "సంరక్షకుడి ధృవీకరణ రహస్యం",
  "Ask the parent for the verification secret": "ధృవీకరణ రహస్యాన్ని తల్లిదండ్రులను అడగండి",
  "Verifying...": "ధృవీకరిస్తోంది...",
  "Verify guardian & show contact": "సంరక్షకుడిని ధృవీకరించి సంప్రదింపు చూపండి",
  "Guardian verified": "సంరక్షకుడు ధృవీకరించబడ్డారు",
  "Call the parent, then physically hand over the child before confirming below.": "తల్లిదండ్రులకు ఫోన్ చేసి, పిల్లవాడిని ప్రత్యక్షంగా అప్పగించిన తర్వాత కింద నిర్ధారించండి.",
  "I confirm the child has been handed to the verified parent/guardian.": "ధృవీకరించిన తల్లిదండ్రి/సంరక్షకుడికి పిల్లవాడిని అప్పగించానని నిర్ధారిస్తున్నాను.",
  "Recording handover...": "అప్పగింతను నమోదు చేస్తోంది...",
  "Confirm physical handover": "ప్రత్యక్ష అప్పగింతను నిర్ధారించండి",
  "A handover is counted only after guardian verification and your physical-handover confirmation.": "సంరక్షకుడిని ధృవీకరించి, ప్రత్యక్ష అప్పగింతను నిర్ధారించిన తర్వాతే లెక్కలోకి తీసుకుంటాం.",
  "Family app": "కుటుంబ యాప్",
  "Volunteer seva desk · Personal details are shown only when reuniting a family.": "వాలంటీర్ సేవా డెస్క్ · కుటుంబాన్ని కలిపేటప్పుడు మాత్రమే వ్యక్తిగత వివరాలు చూపబడతాయి.",
  "Volunteer approvals": "వాలంటీర్ ఆమోదాలు",
  "{count} pending": "{count} పెండింగ్",
  "No volunteer registrations need review.": "సమీక్షించాల్సిన వాలంటీర్ నమోదులు లేవు.",
  "Requested {date}": "{date}న అభ్యర్థించారు",
  "Approve": "ఆమోదించండి",
  "Reject": "తిరస్కరించండి",
  "Alternative mobile number": "ప్రత్యామ్నాయ మొబైల్ నంబర్",
  "Optional": "ఐచ్ఛికం",
  "Alternative": "ప్రత్యామ్నాయం",
  "Enter a different valid alternative mobile number, or leave it blank.": "వేరే చెల్లుబాటు అయ్యే ప్రత్యామ్నాయ మొబైల్ నంబర్ ఇవ్వండి లేదా ఖాళీగా ఉంచండి.",
  "Mobile sign-in or registration": "మొబైల్ సైన్ ఇన్ లేదా నమోదు",
  "Email or mobile number": "ఇమెయిల్ లేదా మొబైల్ నంబర్",
  "Send mobile code": "మొబైల్ కోడ్ పంపండి",
  "Verify & continue": "ధృవీకరించి కొనసాగండి",
  "Change email or mobile number": "ఇమెయిల్ లేదా మొబైల్ నంబర్ మార్చండి",
  "A verification code was sent to your mobile number.": "మీ మొబైల్ నంబర్‌కు ధృవీకరణ కోడ్ పంపించాం.",
  "I verified my email": "నా ఇమెయిల్‌ను ధృవీకరించాను",
  "Check your email for a verification link, then return here.": "ధృవీకరణ లింక్ కోసం మీ ఇమెయిల్‌ను చూసి, తర్వాత ఇక్కడికి తిరిగి రండి.",
  "Email verification": "ఇమెయిల్ ధృవీకరణ",
  "Email address": "ఇమెయిల్ చిరునామా",
  "One-time code": "ఒకసారి ఉపయోగించే కోడ్",
  "Password": "పాస్‌వర్డ్",
  "Please wait...": "దయచేసి వేచి ఉండండి...",
  "Sign in": "సైన్ ఇన్",
  "Verify & sign in": "ధృవీకరించి సైన్ ఇన్ చేయండి",
  "Send sign-in code": "సైన్-ఇన్ కోడ్ పంపండి",
  "Change email": "ఇమెయిల్ మార్చండి",
  "Use email code": "ఇమెయిల్ కోడ్ ఉపయోగించండి",
  "Use password": "పాస్‌వర్డ్ ఉపయోగించండి",
  "Enter your email code": "మీ ఇమెయిల్ కోడ్ నమోదు చేయండి",
  "A one-time code was sent to {email}.": "{email}కు ఒకసారి ఉపయోగించే కోడ్ పంపించాం.",
  "Could not send the sign-in code.": "సైన్-ఇన్ కోడ్ పంపలేకపోయాం.",
  "Could not verify the sign-in code.": "సైన్-ఇన్ కోడ్‌ను ధృవీకరించలేకపోయాం.",
  "Could not sign in with that password.": "ఆ పాస్‌వర్డ్‌తో సైన్ ఇన్ చేయలేకపోయాం.",
  "Set or reset password": "పాస్‌వర్డ్ సెట్ లేదా రీసెట్ చేయండి",
  "Verify your email with a code, then choose a password for future sign-ins.": "కోడ్‌తో మీ ఇమెయిల్‌ను ధృవీకరించి, తదుపరి సైన్-ఇన్‌ల కోసం పాస్‌వర్డ్ ఎంచుకోండి.",
  "Send password code": "పాస్‌వర్డ్ కోడ్ పంపండి",
  "Cancel": "రద్దు చేయండి",
  "A password code was sent to {email}.": "{email}కు పాస్‌వర్డ్ కోడ్ పంపించాం.",
  "New password": "కొత్త పాస్‌వర్డ్",
  "8–128 characters": "8–128 అక్షరాలు",
  "Confirm new password": "కొత్త పాస్‌వర్డ్‌ను నిర్ధారించండి",
  "Set password": "పాస్‌వర్డ్ సెట్ చేయండి",
  "Resend code": "కోడ్ మళ్లీ పంపండి",
  "Passwords do not match.": "పాస్‌వర్డ్‌లు సరిపోలడం లేదు.",
  "Could not send the password code.": "పాస్‌వర్డ్ కోడ్ పంపలేకపోయాం.",
  "Could not set the password.": "పాస్‌వర్డ్ సెట్ చేయలేకపోయాం.",
  "Password set. Use it for future sign-ins.": "పాస్‌వర్డ్ సెట్ అయింది. తదుపరి సైన్-ఇన్‌లలో దీన్ని ఉపయోగించండి.",
  "PDF": "PDF",
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

export type Translator = LanguageContextValue["t"];

const LanguageContext = createContext<LanguageContextValue | null>(null);
const languageStorageKey = "pushkar-suraksha-language";
const languageListeners = new Set<() => void>();
let currentLanguage: Language = "en";

function getLanguageSnapshot(): Language {
  if (typeof window !== "undefined") {
    currentLanguage = window.localStorage.getItem(languageStorageKey) === "te" ? "te" : "en";
  }
  return currentLanguage;
}

function getServerLanguageSnapshot(): Language {
  return "en";
}

function subscribeToLanguage(listener: () => void) {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}

function storeLanguage(language: Language) {
  currentLanguage = language;
  window.localStorage.setItem(languageStorageKey, language);
  languageListeners.forEach((listener) => listener());
}

export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = useSyncExternalStore(
    subscribeToLanguage,
    getLanguageSnapshot,
    getServerLanguageSnapshot,
  );
  const setLanguage = useCallback((nextLanguage: Language) => storeLanguage(nextLanguage), []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback<Translator>((key, values) => {
    let result = language === "te" ? translations[key] ?? key : key;
    for (const [name, replacement] of Object.entries(values ?? {})) {
      result = result.split(`{${name}}`).join(String(replacement));
    }
    return result;
  }, [language]);
  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider.");
  return context;
}

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className="language-control">
      <span>{t("Language")}</span>
      <select
        aria-label={t("Language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="en">English</option>
        <option value="te">తెలుగు</option>
      </select>
    </label>
  );
}
