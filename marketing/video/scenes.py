# Scenes for the MediCore agent training video: narration + what is on screen
IMG = '/home/claude/manual/site/img/'
SH2 = '/home/claude/manual/shots2/'
PS = '/tmp/claude-0/-home-claude/5eb60b6b-dc24-55ea-914b-358f6cbd8611/scratchpad/pshots/'

SCENES = [
  dict(kind='title', kicker='Pentarch MediCore · Agent training', title='How to sell MediCore', sub='Find the client, show the demo, start the free 30 days, close the sale.',
       say="Welcome to Pentarch MediCore agent training. In the next few minutes you will learn how to find the right facilities, show MediCore in ten minutes, start a free thirty day demo, and close the sale."),
  dict(kind='cards', kicker='What MediCore is', title='One system for the whole facility', cards=[
         ('Pharmacies', 'Scan-and-sell counter, stock by batch and expiry, cash-up and profit reports.'),
         ('Clinics', 'Patients, queue, consultation, lab, dispensing and billing, including SHA.'),
         ('Hospitals', 'Everything a clinic has, plus admissions, wards, maternity and branches.')],
       say="MediCore runs the counter, the stock, the patients, the lab and the money in one place. It runs on a computer inside the facility, so it keeps working when the internet or the power goes off. Pharmacies, clinics and hospitals each get the screens they need."),
  dict(kind='list', kicker='Before you demo', title='Ask five questions', items=[
         'How do you record sales and stock today?', 'How do you find out what is about to expire?',
         'When did you last count stock, and did it match?', 'Who closes the till at night, and how is cash checked?',
         'How many counters, staff and branches do you have?'],
       say="Talk to the owner or the superintendent pharmacist, the person who signs the cheques. Before you demo, ask five questions. How do you record sales today? How do you track expiry? When did you last count stock? Who checks the cash at night? And how many staff and branches do you have? A facility using a book or Excel, with expiry losses or cash gaps, is your best prospect."),
  dict(kind='shot', kicker='Demo · step 1 of 4', title='Sell: scan, pay, print', img=IMG + 'pharm_pos.jpg',
       say="Now the ten minute demo. Step one, sell. Scan or search an item, add a second one, take M-Pesa or cash, and show the receipt. Keep it quick. The owner should see how fast the counter is."),
  dict(kind='shot', kicker='Demo · step 2 of 4', title='Stock: expiry and reorder', img=IMG + 'pharm_inventory_low.jpg',
       say="Step two, stock. Open inventory and show the expiry warnings and the reorder list. Every batch is tracked from delivery to the receipt, so the owner knows what will expire before it costs money."),
  dict(kind='shot', kicker='Demo · step 3 of 4', title='Money: profit for today', img=SH2 + 'rep_profit.png',
       say="Step three, money. Open reports, profit and loss. Show today's sales, the cost of what was sold, the gross profit and the expenses. This is the screen owners remember."),
  dict(kind='shot', kicker='Demo · step 4 of 4', title='Control: close the shift', img=SH2 + 'cashup.png',
       say="Step four, control. Close a shift. The cashier counts the drawer note by note, and MediCore shows whether the cash is over or short, with the cashier's name on it. Then explain that all of this works with the internet switched off."),
  dict(kind='phone', kicker='Start the free demo', title='One minute, from your phone', imgs=[PS + 'v-client.png', PS + 'v-demo.png'],
       say="Finish by asking: shall I set up your own copy now, free for thirty days? In the sales portal, open the client and tap start thirty day demo. Then send the sign-in on WhatsApp, and sit with them while they make one test sale. A demo opened in front of you is far more likely to be used."),
  dict(kind='table', kicker='During the 30 days', title='Get the demo used', rows=[
         ('Day 2', 'Call: did you sign in? Try receiving and selling one item.'),
         ('Day 5', 'Visit or call: check sales are being recorded.'),
         ('Day 12', "Call the owner: show their own profit and expiry reports."),
         ('Day 20', 'Visit: ask for the decision and send the quotation.'),
         ('Day 30', 'Mark it won, or record why it was lost.')],
       say="A demo nobody uses never converts. Call on day two. Check on day five that sales are being recorded. On day twelve, show the owner their own reports. On day twenty, ask for the decision and send the quotation from the portal. The portal tells you how much each demo is being used, so call any client who has not started."),
  dict(kind='list', kicker='Closing the sale', title='Two ways to buy', items=[
         'Complete package: software plus the Counter Kit, installed and trained.',
         'Setup only: MediCore on the computers they already have.',
         'The client pays Pentarch directly. Agents never collect money.',
         'Tap Mark as won. Pentarch calls within one working day to install.'],
       say="Offer two packages. The complete package includes the Counter Kit: computer, scanner, receipt printer, cash drawer and power backup, installed and with staff trained. Or setup only, on the computers they already have. Build the quote in the portal. The client pays Pentarch directly. You never collect money. Tap mark as won, and Pentarch calls within one working day to book installation. If the client was on the demo, it becomes their live system."),
  dict(kind='list', kicker='Agent rules', title='Protect the client and your commission', items=[
         'Quote only the prices in the portal.', 'Never collect money.',
         'Never promise a feature or date Pentarch has not confirmed.', 'Record every client in the portal the same day.',
         'Keep client details private.'],
       say="Five rules. Quote only the prices in the portal. Never collect money. Never promise a feature or a date that Pentarch has not confirmed. Record every client the same day, because the first agent to record a client is the one who earns. And keep client details private."),
  dict(kind='end', kicker='Pentarch Communications', title='Questions? Call or WhatsApp Pentarch', sub='+254 729 455 912 · medicore.pentarchcommunications.com/portal',
       say="That's it. Record your clients, start demos, follow up, and close. If you need help with a client, call or WhatsApp Pentarch on zero seven two nine, four five five, nine one two. Good luck."),
]
