import type { PhotoName } from "./design";
export type SolutionContent = {
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  photo: PhotoName;
  caption?: string;
  sectionTitle: string;
  features: string[][];
  secondPhoto: PhotoName;
  secondTitle: string;
  secondBody: string;
  checks: string[];
  secondCaption?: string;
  preview?: boolean;
  payments?: boolean;
};
export const SOLUTIONS: SolutionContent[] = [
  {
    path: "/pos",
    eyebrow: "The Surge POS",
    title: "A calmer way to run a busy business.",
    description:
      "From the first order to the end-of-day report, keep your counter, kitchen, stock and team in one connected workspace.",
    photo: "counter",
    caption:
      "Illustrative product preview. Device compatibility is confirmed during setup.",
    sectionTitle: "Built around a real working day.",
    features: [
      [
        "Orders, without the detours",
        "Build orders, add modifiers, apply discounts and keep the details with the ticket.",
      ],
      [
        "Floor and kitchen, connected",
        "Manage tables, seats and courses. Route preparation tickets to the right kitchen station.",
      ],
      [
        "Your menu, organized",
        "Arrange categories, prices and modifier groups, and update availability as the day changes.",
      ],
      [
        "Stock with context",
        "Track ingredients and products, manage purchasing and record stock adjustments.",
      ],
      [
        "A place for your whole team",
        "Manage staff access, shifts and time tracking with permissions for different responsibilities.",
      ],
      [
        "Reports you can use",
        "Review sales and item performance, then export the detail you need.",
      ],
    ],
    secondPhoto: "service",
    secondTitle: "At the counter. Out on the floor.",
    secondBody:
      "Build a setup around your space. A compact tablet can keep the counter clear, while a handheld device puts order entry closer to the table.",
    checks: [
      "Tablet-first layouts for daily tasks",
      "Kitchen and customer-facing displays",
      "Device and peripheral compatibility checked before setup",
    ],
    preview: true,
  },
  {
    path: "/pos-for-restaurants",
    eyebrow: "Surge for restaurants",
    title: "Keep the whole room in rhythm.",
    description:
      "One clear flow from the host stand to the kitchen. Give your team the table, order and menu details they need to look after every guest.",
    photo: "service",
    sectionTitle: "From a quick lunch to the last sitting.",
    features: [
      [
        "Know your floor",
        "Arrange tables and follow their status through service, with seat and course details close at hand.",
      ],
      [
        "Make the order personal",
        "Use modifiers and order notes to capture the small details your guests care about.",
      ],
      [
        "Keep the kitchen in the loop",
        "Send preparation tickets to the right station and give the team a shared view of what is next.",
      ],
      [
        "Keep the menu current",
        "Update prices, categories and availability as your menu changes.",
      ],
      [
        "Manage the people behind service",
        "Set roles, manage shifts and track staff time in the same workspace.",
      ],
      [
        "Understand the day",
        "Review sales, items, discounts and voids with reports and an audit trail.",
      ],
    ],
    secondPhoto: "owner",
    secondTitle: "A menu that works the way you do.",
    secondBody:
      "Build clear categories, reusable modifiers and a menu structure that helps the team find what they need. Start with the dishes and service style you already know.",
    checks: [
      "Flexible categories and modifier groups",
      "Item availability controls",
      "Kitchen routing and order notes",
    ],
  },
  {
    path: "/pos-for-retail",
    eyebrow: "Surge for retail",
    title: "More time for the person across the counter.",
    description:
      "Bring your products, stock and daily sales into one clear workspace. A lighter tablet setup leaves room for what makes your shop yours.",
    photo: "retail",
    sectionTitle: "The everyday details of running a shop.",
    features: [
      [
        "Find the right product",
        "Organize your catalog and use barcodes to bring the right item into an order.",
      ],
      [
        "Stay close to stock",
        "Track quantities, record adjustments and keep purchasing organized.",
      ],
      [
        "Keep checkout clear",
        "Manage discounts, receipts and returns with the context your team needs.",
      ],
      [
        "Give staff the right access",
        "Set permissions for everyday work and manager responsibilities.",
      ],
      [
        "Know how the day went",
        "Review sales and product performance without piecing together separate records.",
      ],
      [
        "Keep growing, thoughtfully",
        "Organize multiple locations and confirm the setup each shop needs.",
      ],
    ],
    secondPhoto: "counter",
    secondTitle: "A smaller footprint. A clearer counter.",
    secondBody:
      "Plan around a slim tablet instead of a bulky workstation. We’ll confirm your device, scanner and printer requirements before you change your hardware.",
    checks: [
      "A tablet setup that suits your space",
      "Product catalog and inventory workflows",
      "Device compatibility reviewed with your team",
    ],
    secondCaption: "Illustrative product preview.",
  },
  {
    path: "/solutions/cafes",
    eyebrow: "Surge for cafes & quick service",
    title: "Ready for the morning rush.",
    description:
      "Keep orders clear, modifiers close and the counter moving. Bring the bar, kitchen and front-of-house team into the same flow.",
    photo: "cafe",
    sectionTitle: "The little things that keep the line moving.",
    features: [
      [
        "Get the details right",
        "Set up sizes, milk choices and extras as modifiers your team can find quickly.",
      ],
      [
        "Send each item to its station",
        "Keep drinks and food preparation organized with kitchen routing.",
      ],
      [
        "Keep availability up to date",
        "Update items as specials change or the last pastry leaves the counter.",
      ],
      [
        "Make the menu easy to navigate",
        "Arrange familiar categories around your service style.",
      ],
      [
        "Keep stock in sight",
        "Track the products and ingredients behind your menu.",
      ],
      [
        "Learn from each shift",
        "Review item sales and staff time to understand the shape of your day.",
      ],
    ],
    secondPhoto: "team",
    secondTitle: "Tools that fit behind your counter.",
    secondBody:
      "A compact tablet makes room for the work around it. We’ll help you review the layout, menu and device needs for your business.",
    checks: [
      "Compact counter and handheld options",
      "Modifiers built around your menu",
      "Practical help planning your setup",
    ],
  },
  {
    path: "/solutions/multi-location",
    eyebrow: "Surge for multiple locations",
    title: "Different doors. A clearer view.",
    description:
      "Keep each location organized while giving the right people access to the wider business. Build a setup that respects how each team works.",
    photo: "team",
    sectionTitle: "Room for another location.",
    features: [
      [
        "Keep locations organized",
        "Switch between locations while keeping their operational work in context.",
      ],
      [
        "Set access deliberately",
        "Give managers and staff the permissions they need for their responsibilities.",
      ],
      [
        "Understand each business",
        "Review sales and operational reports for the location you are working in.",
      ],
      [
        "Plan the hardware",
        "Confirm devices, display stations and peripherals for each space.",
      ],
      [
        "Make onboarding repeatable",
        "Use a shared checklist for menus, roles, stock and opening procedures.",
      ],
      [
        "Review the rollout together",
        "Talk through your locations, currencies, taxes and local requirements before setup.",
      ],
    ],
    secondPhoto: "retail",
    secondTitle: "A rollout that starts with the details.",
    secondBody:
      "Tell us where each location operates and how your team is structured. We’ll confirm current product fit and support availability before you commit to a rollout.",
    checks: [
      "Review requirements location by location",
      "Confirm device and workflow fit",
      "Agree on an achievable pilot plan",
    ],
  },
  {
    path: "/setup-and-support",
    eyebrow: "Setup & support",
    title: "A good start makes all the difference.",
    description:
      "Bring your menu, your questions and the way you work. We’ll help you plan a sensible setup and get to know the POS before your first service.",
    photo: "team",
    sectionTitle: "Let’s get the essentials in place.",
    features: [
      [
        "Talk through the business",
        "Share your service style, country, time zone and the work you want to simplify.",
      ],
      [
        "Check the setup",
        "Review tablets, printers, scanners and kitchen displays before buying or changing hardware.",
      ],
      [
        "Prepare your information",
        "Bring your menu or product list, modifiers, prices and staff responsibilities.",
      ],
      [
        "Walk through the workflow",
        "Try an order, a kitchen ticket and an end-of-day report with your team.",
      ],
      [
        "Plan your pilot",
        "Confirm scope, setup availability and how you’ll work alongside your current processor.",
      ],
      [
        "Keep the conversation open",
        "Use our contact form to raise a question or discuss what your team needs next.",
      ],
    ],
    secondPhoto: "service",
    secondTitle: "Tell us where you are. We’ll take it from there.",
    secondBody:
      "We welcome enquiries internationally. We’ll review your business, devices and location, then confirm whether remote or on-site setup assistance is available.",
    checks: [
      "Business and device requirements reviewed",
      "Country and time zone considered",
      "Clear next steps before setup",
    ],
  },
  {
    path: "/choosing-a-pos",
    eyebrow: "A practical buying guide",
    title: "Choose the fit. Then the features.",
    description:
      "The right POS should make your working day clearer. Start with your team, your space and the tasks you repeat most often.",
    photo: "owner",
    sectionTitle: "Six things worth checking in a demo.",
    features: [
      [
        "Your real workflow",
        "Ask to see a common order, a modifier, a return and an end-of-day report.",
      ],
      [
        "The people using it",
        "Include a staff member and a manager so both can test their everyday responsibilities.",
      ],
      [
        "Your menu or catalog",
        "Try the categories, variations and notes your business actually needs.",
      ],
      [
        "Your physical space",
        "Check where the tablet, printer and display will sit, and who needs to reach them.",
      ],
      [
        "The full commitment",
        "Review software, hardware, setup, support and any separate payment agreements.",
      ],
      [
        "The move itself",
        "Ask what can be imported, what needs checking and how you can exit the arrangement.",
      ],
    ],
    secondPhoto: "team",
    secondTitle: "Bring your hardest everyday task.",
    secondBody:
      "A useful demo starts with what your team does today. Tell us where things get awkward, and we’ll walk through how Surge handles that workflow.",
    checks: [
      "A practical look at your everyday needs",
      "A walkthrough based on your business",
      "Clear answers about available features",
    ],
  },
  {
    path: "/pos-costs",
    eyebrow: "Understanding POS costs",
    title: "See the whole setup. Understand the whole cost.",
    description:
      "Software is only part of the picture. Put hardware, setup, support and payment arrangements on the same page before deciding.",
    photo: "guides",
    sectionTitle: "A checklist for a clearer conversation.",
    features: [
      [
        "Software",
        "Check what the subscription or pilot includes, how locations are counted and what changes later.",
      ],
      [
        "Devices and peripherals",
        "Confirm whether existing tablets, printers and scanners are compatible before replacing them.",
      ],
      [
        "Setup and data",
        "Ask which setup tasks are included and which you will need to complete yourself.",
      ],
      [
        "Support",
        "Clarify available channels, coverage and what assistance is included.",
      ],
      [
        "Payment arrangements",
        "Review your separate processor agreement, including equipment and account fees.",
      ],
      [
        "Changes and cancellation",
        "Ask how renewal, cancellation and data exports work before committing.",
      ],
    ],
    secondPhoto: "counter",
    secondTitle: "Where Surge stands today.",
    secondBody:
      "Surge offers a free POS pilot. Post-pilot pricing has not been published. Payment processing and terminals are not currently available from Surge, and no processing rate or hardware price is being quoted.",
    checks: [
      "Free POS software during the pilot",
      "Current pilot details on our pricing page",
      "Your payment processor remains separate",
    ],
    secondCaption: "Illustrative product preview.",
  },
  {
    path: "/pos-hardware",
    eyebrow: "Tablets & hardware",
    title: "Less hardware. More counter space.",
    description:
      "Build around a slim tablet, with a compact handheld option for the floor. A good setup should fit the room and the people using it.",
    photo: "counter",
    caption:
      "Illustrative product preview. Confirm device compatibility before purchasing.",
    sectionTitle: "Start with the work each device needs to do.",
    features: [
      [
        "At the counter",
        "A tablet on a low stand keeps the screen within reach without dominating the counter.",
      ],
      [
        "On the floor",
        "A compact device, such as an iPad mini, can suit handheld order entry. Confirm your exact model and software version.",
      ],
      [
        "In the kitchen",
        "Plan display placement around stations, visibility and the conditions in your kitchen.",
      ],
      [
        "Behind the receipt",
        "Check printer and scanner compatibility as part of the setup conversation.",
      ],
      [
        "Across the network",
        "Review connectivity, charging and what happens if a device becomes unavailable.",
      ],
      [
        "Before you buy",
        "Send us your existing hardware list. We’ll confirm what is suitable for your intended workflow.",
      ],
    ],
    secondPhoto: "service",
    secondTitle: "Make room for the work around it.",
    secondBody:
      "Keep charging points accessible, allow space for receipts and place shared screens where the right people can see them. Small decisions make a setup easier to live with.",
    checks: [
      "Slim counter tablets",
      "Compact handheld devices",
      "Compatibility confirmed before setup",
    ],
    payments: true,
  },
  {
    path: "/payments-and-pos",
    eyebrow: "Payments & POS",
    title: "Your operations today. Payments to come.",
    description:
      "Surge runs the point of sale. Your existing processor handles card payments separately during the pilot. Our card processing and terminal are still in development.",
    photo: "counter",
    caption:
      "POS device illustration. No Surge payment terminal is available today.",
    sectionTitle: "Two parts of the setup, clearly explained.",
    features: [
      [
        "The point of sale",
        "Manage your menu, orders, stock, staff and reports in Surge.",
      ],
      [
        "Your existing processor",
        "Keep the provider and payment equipment you currently use while piloting the POS.",
      ],
      [
        "Coming soon",
        "Surge card processing and a dedicated payment terminal are in development.",
      ],
      [
        "Availability",
        "Supported markets, final hardware and launch timing have not been announced.",
      ],
      [
        "Pricing",
        "There is no current Surge processing rate or payment terminal price to quote.",
      ],
      [
        "Your next step",
        "Book a POS demo and ask how the pilot works alongside your current payment setup.",
      ],
    ],
    secondPhoto: "team",
    secondTitle: "Start with a clear conversation.",
    secondBody:
      "Tell us how you take payments today. We’ll explain the current POS workflow and what remains separate, so you can evaluate the pilot with the right expectations.",
    checks: [
      "No processor switch required for the pilot",
      "No terminal purchase or preorder",
      "Future availability will be announced clearly",
    ],
    payments: true,
  },
  {
    path: "/switching-to-surge",
    eyebrow: "Switching to Surge",
    title: "A thoughtful move. A smoother start.",
    description:
      "Changing your POS should begin with a clear plan. Take stock of your menu, devices and team’s routines before your first day on a new setup.",
    photo: "team",
    sectionTitle: "Make your move in manageable steps.",
    features: [
      [
        "Map what you use today",
        "List your products, modifiers, devices, reports and everyday workarounds.",
      ],
      [
        "Check what fits",
        "Walk through Surge with your own workflows and confirm current feature availability.",
      ],
      [
        "Prepare your data",
        "Export and retain the information you need from your existing system. Confirm import options with us.",
      ],
      [
        "Confirm the setup",
        "Review device compatibility, permissions and how payments stay separate during the pilot.",
      ],
      [
        "Practice with your team",
        "Run through common orders and exceptions before using the POS during a busy service.",
      ],
      [
        "Review before committing",
        "Agree on the pilot scope and check your existing contracts before making any changes.",
      ],
    ],
    secondPhoto: "owner",
    secondTitle: "Keep the things that make your business yours.",
    secondBody:
      "Your menu, your way of serving and your team’s experience should guide the move. We’ll help you assess the fit before you plan a cutover.",
    checks: [
      "A demo based on your daily work",
      "A practical setup checklist",
      "Clear expectations for the pilot",
    ],
  },
];
