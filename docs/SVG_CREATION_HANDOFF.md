# SVG Educational Visuals - Continuation Handoff

> **Last Updated:** December 27, 2024 at 12:55 AM MST  
> **Status:** ✅ COMPLETE - 56 SVGs created, all priority topics covered

---

## 🎯 Objective

Create professional SVG educational diagrams for lessons that need visual aids. The visual needs audit identified **982 high-priority lessons** that would benefit from diagrams, illustrations, or interactive resources.

---

## ✅ What's Been Done

### SVG Library Created (56 diagrams)

Located in `public/images/lessons/`:

#### Mathematics (23 files in `math/`)
- `geometry_transformations.svg` - Rotation, reflection, translation, dilation
- `fraction_concepts.svg` - Circle/bar models, number line, equivalents
- `coordinate_plane.svg` - 4 quadrants with example points
- `area_perimeter.svg` - Comparison with formulas
- `multiplication_table.svg` - 1-10 table
- `place_value.svg` - Millions to ones chart
- `types_of_angles.svg` - Acute, right, obtuse, straight, reflex
- `geometric_shapes.svg` - 2D and 3D shapes
- `types_of_lines.svg` - Parallel, perpendicular, intersecting
- `number_line.svg` - -10 to +10 integers
- `order_of_operations.svg` - PEMDAS
- `telling_time.svg` - Analog clock
- `types_of_graphs.svg` - Bar, line, pie
- `decimals_fractions_percentages.svg` - Conversion chart
- `number_bonds.svg` - Part-part-whole relationships
- `symmetry.svg` - Lines of symmetry examples
- `venn_diagram.svg` - Compare and contrast
- `probability.svg` - Spinners, dice, outcomes
- `pythagorean_theorem.svg` - Visual proof with squares
- `money_coins.svg` - US coins and bills
- `bar_models.svg` - Tape diagrams for problem solving
- `measurement_tools.svg` - Ruler, protractor, scale, thermometer ✨ NEW
- `slope_linear.svg` - Rise over run, y=mx+b ✨ NEW

#### Science (20 files in `science/`)
- `water_cycle.svg` - Evaporation, condensation, precipitation
- `solar_system.svg` - 8 planets
- `plant_lifecycle.svg` - Seed to fruit
- `food_chain.svg` - Producers → consumers → decomposers
- `butterfly_lifecycle.svg` - Complete metamorphosis
- `body_systems.svg` - Major organ systems
- `states_of_matter.svg` - Solid, liquid, gas particles
- `simple_machines.svg` - All 6 types
- `photosynthesis.svg` - Inputs/outputs
- `rock_cycle.svg` - Igneous, sedimentary, metamorphic
- `cell_structure.svg` - Plant cell vs animal cell
- `moon_phases.svg` - 8 phases from new to full
- `layers_of_earth.svg` - Crust, mantle, cores
- `atom_structure.svg` - Protons, neutrons, electrons
- `electrical_circuits.svg` - Series vs parallel
- `seasons.svg` - Earth tilt and orbit
- `digestive_system.svg` - Organs and food path
- `light_spectrum.svg` - Prism and wavelengths
- `weather_symbols.svg` - Sunny, cloudy, rain, snow, etc.

#### English Language Arts (10 files in `ela/`)
- `plot_diagram.svg` - Story structure arc
- `parts_of_speech.svg` - 8 parts with examples
- `sentence_structure.svg` - Subject, predicate, object
- `types_of_sentences.svg` - Declarative, interrogative, imperative, exclamatory
- `cause_and_effect.svg` - Signal words and relationships
- `main_idea_details.svg` - Central idea with supporting details
- `figurative_language.svg` - Simile, metaphor, personification, etc.
- `punctuation.svg` - Period, comma, question mark, etc.
- `text_features.svg` - Headings, captions, glossary, index ✨ NEW

#### Social Studies (5 files in `social_studies/`)
- `branches_of_government.svg` - Legislative, Executive, Judicial
- `us_regions_map.svg` - ⚠️ Exists but NOT in script (maps need realistic images)
- `compass_rose.svg` - Cardinal and intermediate directions
- `timeline.svg` - Reading historical timelines ✨ NEW
- `supply_demand.svg` - Economics supply and demand curves ✨ NEW

### Scripts Available

1. **`scripts/audit_visual_needs.ts`** - Scans all lessons and scores them for visual needs
   - Run: `npx tsx scripts/audit_visual_needs.ts`
   - Output: `data/audits/visual_needs_audit.json`

2. **`scripts/add_lesson_visuals.ts`** - Adds images to matching lessons
   - Dry run: `npx tsx scripts/add_lesson_visuals.ts --dry-run`
   - Commit: `npx tsx scripts/add_lesson_visuals.ts --commit`
   - Contains `CONCEPT_IMAGE_MAP` that maps concepts to SVG files

---

## 📝 How to Add a New SVG

### Step 1: Create the SVG file

```bash
# Example location
public/images/lessons/[subject]/[name].svg
```

**SVG Guidelines:**
- Viewport: `viewBox="0 0 700 400"` (or similar aspect ratio)
- Use system-ui font: `font-family="system-ui, sans-serif"`
- Brand colors: 
  - Blue: `#3b82f6` (primary)
  - Green: `#22c55e` (success)
  - Purple: `#8b5cf6` (accent)
  - Orange: `#f59e0b` (warning)
  - Red: `#ef4444` (error)
- Include `<title>` and `<desc>` for accessibility
- **IMPORTANT:** Escape ampersands as `&amp;` in text elements

### Step 2: Add to the CONCEPT_IMAGE_MAP

In `scripts/add_lesson_visuals.ts`, add an entry:

```typescript
'concept_name': {
    imageUrl: '/images/lessons/[subject]/[filename].svg',
    altText: 'Description of the diagram',
    forStrands: ['Relevant Strand 1', 'Relevant Strand 2'],
    forTopics: ['Topic Keyword 1', 'Topic Keyword 2', 'Topic Keyword 3'],
},
```

### Step 3: Run the integration script

```bash
npx tsx scripts/add_lesson_visuals.ts --dry-run  # Preview
npx tsx scripts/add_lesson_visuals.ts --commit   # Apply
```

---

## 🚀 Topics That Still Need SVGs

Based on the visual needs audit (`data/audits/visual_needs_audit.json`), these concepts appear frequently and don't have SVGs yet:

### High Priority - Mathematics
- [x] **Number bonds** - Part-part-whole relationships ✅
- [x] **Symmetry** - Lines of symmetry, rotational symmetry ✅
- [x] **Measurement tools** - Ruler, protractor, scale ✅
- [x] **Money/coins** - Counting money, making change ✅
- [ ] **Pattern blocks** - Shape patterns, tessellations
- [x] **Bar models** - Part-whole problem solving ✅
- [x] **Venn diagrams** - Set theory, comparisons ✅
- [x] **Probability** - Spinners, dice, outcomes ✅
- [x] **Slope/linear equations** - Rise over run ✅
- [x] **Pythagorean theorem** - Visual proof with squares ✅

### High Priority - Science
- [x] **Rock cycle** - Igneous, sedimentary, metamorphic ✅
- [x] **Cell structure** - Plant cell vs animal cell ✅
- [x] **Layers of Earth** - Crust, mantle, core ✅
- [x] **Moon phases** - New to full cycle ✅
- [x] **Electrical circuits** - Series vs parallel ✅
- [x] **Light spectrum** - Rainbow, prism, wavelengths ✅
- [x] **Digestive system** - Organs and path of food ✅
- [x] **Atom structure** - Protons, neutrons, electrons ✅
- [x] **Seasons** - Earth's tilt and orbit ✅
- [x] **Weather symbols** - Sunny, cloudy, rain, etc. ✅

### High Priority - ELA
- [x] **Types of sentences** - Declarative, interrogative, etc. ✅
- [x] **Punctuation** - Periods, commas, quotation marks ✅
- [x] **Main idea & details** - Central idea with supporting points ✅
- [x] **Compare & contrast** - Venn diagram style (see math/venn_diagram.svg) ✅
- [x] **Cause & effect** - Arrow-based diagram ✅
- [x] **Figurative language** - Metaphor, simile, personification ✅
- [x] **Text features** - Headings, captions, glossary ✅

### High Priority - Social Studies
- ⚠️ **Maps should use AI-generated images or real maps, NOT SVG**
- [x] **Timeline template** - Historical events ✅
- [x] **Compass rose** - Cardinal directions ✅
- [x] **Supply & demand** - Economics curve ✅

---

## ⚠️ Important Notes

1. **Maps don't work well as SVGs** - The US regions map looked unrealistic. Use AI image generation or real images for geographic maps.

2. **Always escape ampersands** - In SVG text, use `&amp;` not `&`. Example: `Fixed shape &amp; volume`

3. **Test in browser** - After creating, visit `http://localhost:5173/images/lessons/[path].svg` to verify rendering

4. **Existing lessons with images are skipped** - The script won't overwrite lessons that already have images

5. **Audit has 300 candidates** - The `visual_needs_audit.json` contains the top 300 lessons most in need of visuals

---

## 📂 File Structure

```
public/images/lessons/
├── ela/
│   ├── parts_of_speech.svg
│   ├── plot_diagram.svg
│   └── sentence_structure.svg
├── math/
│   ├── (14 SVG files)
├── science/
│   ├── (10 SVG files)
└── social_studies/
    ├── branches_of_government.svg
    └── us_regions_map.svg (not in script)

scripts/
├── audit_visual_needs.ts
└── add_lesson_visuals.ts

data/audits/
├── visual_needs_audit.json
└── visual_updates_report.json
```

---

## 📋 Next Steps for New Chat

1. **Pick topics** from the "Topics That Still Need SVGs" list above
2. **Create SVG files** following the guidelines (viewport, colors, fonts, accessibility)
3. **Add mappings** to `CONCEPT_IMAGE_MAP` in `scripts/add_lesson_visuals.ts`
4. **Run integration** with `--commit` flag
5. **Verify** in browser and update this document

---

## 💡 Prompt for New Chat

```
Continue creating educational SVG diagrams for ElevatED. Read the handoff document at docs/SVG_CREATION_HANDOFF.md for full context.

Focus on creating SVGs for:
1. [Pick specific topics from the list]

Follow the existing patterns for SVG structure, colors, and accessibility. After creating each SVG, add it to the CONCEPT_IMAGE_MAP in scripts/add_lesson_visuals.ts and run the integration script.
```
