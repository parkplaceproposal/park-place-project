/*
 * ============================================================
 *  PARK PLACE — PROPOSAL CONTENT
 *  This is the only file you need to edit.
 * ============================================================
 *
 *  FLOOR PLANS
 *    1. Put the file in the "floorplans" folder.
 *    2. Type its file name below, e.g.  floorPlan: "level-1.pdf"
 *    Images (.jpg .jpeg .png .webp .gif .svg) and PDFs (.pdf) are supported.
 *    Leave it as "" to show "Coming soon".
 *    Optional: floorPlanFull is the file that opens when visitors click
 *    "Open full size" (e.g. a sharp PDF of the same sheet).
 *
 *  3D VIEWS (Kuula)
 *    Add one line per view:
 *      { name: "Kitchen", url: "https://kuula.co/share/AbC12" },
 *    You can paste any of these Kuula link styles. They're converted
 *    to an embed link automatically:
 *      https://kuula.co/post/AbC12
 *      https://kuula.co/share/AbC12?logo=1&info=1...
 *      https://kuula.co/share/collection/7abcD?...
 *    Leave the list empty  []  to show "Coming soon".
 *    If a level has 2 or more views, buttons appear to switch between them.
 *
 *  PINS ON THE FLOOR PLAN
 *    Add  pin: { x: 40, y: 38 }  to a view to put a clickable pin on the
 *    floor plan where that 360 image was taken. x and y are percentages of
 *    the floor plan image: x from the left edge, y from the top edge.
 *
 *  Levels appear in the menu in the order listed here (left to right).
 */

window.PROPOSAL = {
  title: "Park Place Renovation and Expansion Proposal",

  defaultLevel: "level-1",

  levels: [
    {
      id: "basement",
      name: "Basement",
      floorPlan: "basement.png",
      floorPlanFull: "basement.pdf",
      views: [
        { name: "Classroom", url: "https://kuula.co/share/LC6vh?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1", pin: { x: 15.4, y: 49.5 } },
        { name: "Kitchenette", url: "https://kuula.co/share/LC6vp?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1", pin: { x: 55.8, y: 57.3 } },
      ],
    },
    {
      id: "level-1",
      name: "Level 1",
      floorPlan: "level-1.png",
      floorPlanFull: "level-1.pdf",
      views: [
        { name: "Dining Room", url: "https://kuula.co/share/LC6v0?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1", pin: { x: 56.5, y: 53.9 } },
        { name: "Kitchen", url: "https://kuula.co/share/LC6vl?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1", pin: { x: 54.2, y: 32.0 } },
        { name: "Living Room", url: "https://kuula.co/share/LC6vk?logo=1&info=1&fs=1&vr=0&sd=1&thumbs=1", pin: { x: 17.4, y: 57.1 } },
      ],
    },
    {
      id: "level-2",
      name: "Level 2",
      floorPlan: "level-2.png",
      floorPlanFull: "level-2.pdf",
      views: [
        // { name: "View name", url: "https://kuula.co/share/XXXXX", pin: { x: 50, y: 50 } },
      ],
    },
    {
      id: "dormer",
      name: "Dormer",
      floorPlan: "dormer.png",
      floorPlanFull: "dormer.pdf",
      views: [
        // { name: "View name", url: "https://kuula.co/share/XXXXX" },
      ],
    },

    // Separate section with only a plan (no 3D views)
    {
      id: "site-plan",
      name: "Site Plan",
      planOnly: true,
      floorPlan: "site-plan.jpg",
    },
  ],
};
