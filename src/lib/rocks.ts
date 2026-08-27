import { getIsoWeekNumber } from "./date";

export type Rock = {
  name: string;
  emoji: string;
  facts: string[];
};

export const rocks: Rock[] = [
  { name: "Pumice", emoji: "🪨", facts: ["It's the only rock that floats — it's full of gas bubbles.", "Formed when frothy lava cools almost instantly.", "People have kept the same bar of pumice in their shower for a decade."] },
  { name: "Obsidian", emoji: "⚫", facts: ["Volcanic glass, not a crystal — it cooled too fast to form one.", "Can be knapped sharper than a surgical scalpel.", "Fractures in smooth curves called conchoidal fractures."] },
  { name: "Geode", emoji: "🔮", facts: ["A boring rock on the outside, a crystal cave on the inside.", "You genuinely can't tell what's inside until you crack it open.", "They form over millions of years from mineral-rich water."] },
  { name: "Carrara Marble", emoji: "🏛️", facts: ["Michelangelo's David is carved from it.", "It's been quarried from the same Italian mountains for 2,000+ years.", "It's just limestone that got squeezed and heated for eons."] },
  { name: "Flint", emoji: "🔥", facts: ["Strike it right and it throws sparks — the original lighter.", "Stone Age toolmakers' favorite material.", "It's a form of quartz that grew inside chalk."] },
  { name: "Magnetite", emoji: "🧲", facts: ["It's naturally magnetic — 'lodestone' was the first compass.", "Some bacteria grow tiny magnetite crystals to navigate.", "It's one of the most magnetic natural minerals on Earth."] },
  { name: "Kidney Ore (Hematite)", emoji: "🩸", facts: ["Its streak is blood-red even when the rock looks silver.", "Named from the Greek for 'blood'.", "It's the main ore we get iron from."] },
  { name: "Fulgurite", emoji: "⚡", facts: ["It's a rock made by a lightning strike hitting sand.", "Basically frozen lightning — a hollow glass tube.", "Collectors dig them up on beaches after storms."] },
];

export function getCurrentRock(date: Date = new Date()): Rock {
  return rocks[getIsoWeekNumber(date) % rocks.length];
}
