#!/usr/bin/env bash
# End-to-end proof of the /pilot/sri-lanka sign-up against a dev build.
#
# It drives the REAL server action (submitPilot) over the Next server-action
# protocol rather than a stub, so what is exercised is the same code path the
# browser uses: zod validation, the honeypot, the minimum fill time, the shared
# five-per-IP-per-hour throttle, and the sendEmail return-value check.
#
# NO MAIL GOES TO A THIRD PARTY. Both the lead copy and the visitor receipt are
# addressed to delivered@resend.dev, Resend's sandbox address, via
# SURGE_LEADS_EMAIL. Nothing is sent to a real person.
#
# Usage:
#   ACTION=<submitPilot server-action id> BASE=http://localhost:3399 ./form-proof.sh
# The id is in the client chunk: grep for '"name":"submitPilot'.
set -u
BASE="${BASE:-http://localhost:3399}"
URL="$BASE/pilot/sri-lanka"
ACTION="${ACTION:?set ACTION to the submitPilot server-action id}"
SANDBOX="delivered@resend.dev"

# 10s in the past, so isTooFast() sees a plausible human fill time.
STARTED=$(( $(date +%s)000 - 10000 ))

post() {
  curl -s -X POST "$URL" \
    -H "Next-Action: $ACTION" \
    -H "Content-Type: text/plain;charset=UTF-8" \
    --data-binary "$1"
}

# Pull the action's JSON result out of the flight stream.
result() { grep -oE '\{"ok":[^}]*\}' | tail -1; }

base_fields() {
  printf '%s' "\"contactName\":\"Proof Runner\",\"email\":\"$SANDBOX\",\"phone\":\"\",\"whatsapp\":\"+94771234567\",\"city\":\"Colombo\",\"businessType\":\"Restaurant\",\"locations\":\"1\",\"currentPos\":\"Paper\",\"painPoint\":\"End-to-end proof run, please ignore.\",\"country\":\"LK\",\"segment\":\"sri-lanka-pilot\",\"onboarding\":\"remote\",\"startedAt\":$STARTED"
}

echo "=============================================================="
echo "1. INVALID SUBMISSION - rejected server-side"
echo "   businessName empty, email malformed. The client never saw it;"
echo "   this is the action's own zod parse."
echo "--------------------------------------------------------------"
post "[{\"businessName\":\"\",\"contactName\":\"\",\"email\":\"not-an-email\",\"businessType\":\"\",\"website\":\"\",\"startedAt\":$STARTED}]" | result
echo

echo "=============================================================="
echo "2. HONEYPOT - silent success, nothing sent"
echo "   The hidden 'website' field is filled, as a bot would. Expect"
echo "   {\"ok\":true} identical to a real sign-up, and NO mail."
echo "--------------------------------------------------------------"
post "[{\"businessName\":\"Bot Cafe\",$(base_fields),\"website\":\"http://spam.example\"}]" | result
echo

echo "=============================================================="
echo "3. TOO FAST - submitted 0ms after mount, also silent success"
echo "--------------------------------------------------------------"
post "[{\"businessName\":\"Fast Bot\",\"contactName\":\"x\",\"email\":\"$SANDBOX\",\"businessType\":\"Restaurant\",\"website\":\"\",\"startedAt\":$(date +%s)000}]" | result
echo

echo "=============================================================="
echo "4-8. FIVE VALID SUBMISSIONS - each should succeed and send"
echo "     Quota is MAX_SENDS_PER_WINDOW = 5 per IP per hour, and it is"
echo "     shared with /contact and /book."
echo "--------------------------------------------------------------"
for i in 1 2 3 4 5; do
  printf "  valid #%s -> " "$i"
  post "[{\"businessName\":\"Proof Cafe $i\",$(base_fields),\"website\":\"\"}]" | result
  echo
done
echo

echo "=============================================================="
echo "9. SIXTH VALID SUBMISSION - the rate limit must trip"
echo "   Expect ok:false and a sentence naming the fallback inbox."
echo "--------------------------------------------------------------"
post "[{\"businessName\":\"Proof Cafe 6\",$(base_fields),\"website\":\"\"}]" | result
echo

echo "=============================================================="
echo "10. HONEYPOT AGAIN, AFTER THE LIMIT - still silent success"
echo "    Proves the honeypot short-circuits BEFORE the throttle, so a"
echo "    bot can never learn the limit exists."
echo "--------------------------------------------------------------"
post "[{\"businessName\":\"Bot Cafe 2\",$(base_fields),\"website\":\"x\"}]" | result
echo
