/**
 * Phase 2: Generate Student-Facing Content
 * 
 * Transforms teacher guide templates into actual student learning content
 * with explanations, examples, and key concepts for each topic.
 * 
 * Part of the Lesson Content Enhancement Plan - Phase 2
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabase: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LessonRecord {
    id: number;
    title: string;
    content: string;
    module_id: number;
    modules: {
        grade_band: string;
        subject: string;
        strand: string | null;
        topic: string | null;
    } | null;
}

// Grade band content length targets
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _CONTENT_LENGTH_TARGETS: Record<string, { min: number; max: number; sentences: number }> = {
    'K': { min: 200, max: 400, sentences: 3 },
    '1': { min: 200, max: 400, sentences: 3 },
    '2': { min: 250, max: 450, sentences: 4 },
    '3': { min: 400, max: 600, sentences: 5 },
    '4': { min: 400, max: 600, sentences: 5 },
    '5': { min: 400, max: 600, sentences: 5 },
    '6': { min: 600, max: 1000, sentences: 6 },
    '7': { min: 600, max: 1000, sentences: 6 },
    '8': { min: 600, max: 1000, sentences: 6 },
    '9': { min: 800, max: 1500, sentences: 8 },
    '10': { min: 800, max: 1500, sentences: 8 },
    '11': { min: 800, max: 1500, sentences: 8 },
    '12': { min: 800, max: 1500, sentences: 8 },
};

// Content templates by subject - comprehensive student-facing content
const CONTENT_TEMPLATES: Record<string, (topic: string, strand: string, grade: string) => string> = {
    'Mathematics': generateMathContent,
    'Science': generateScienceContent,
    'English Language Arts': generateELAContent,
    'Social Studies': generateSocialStudiesContent,
    'Electives': generateElectivesContent,
};

function getGradeBandDescription(grade: string): string {
    const gradeNum = parseInt(grade) || 0;
    if (gradeNum <= 2) return 'young learners';
    if (gradeNum <= 5) return 'elementary students';
    if (gradeNum <= 8) return 'middle school students';
    return 'high school students';
}

function getComplexityLevel(grade: string): 'simple' | 'moderate' | 'advanced' {
    const gradeNum = parseInt(grade) || 0;
    if (gradeNum <= 2) return 'simple';
    if (gradeNum <= 8) return 'moderate';
    return 'advanced';
}

function generateMathContent(topic: string, strand: string, grade: string): string {
    const complexity = getComplexityLevel(grade);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _audience = getGradeBandDescription(grade);

    let intro = '';
    let keyConceptsIntro = '';
    let example = '';
    let practicePrompt = '';
    let vocabulary: string[] = [];
    let summary = '';

    // Generate content based on strand and complexity
    if (strand.toLowerCase().includes('number') || strand.toLowerCase().includes('operation')) {
        if (complexity === 'simple') {
            intro = `Numbers are all around us! We use numbers to count things, tell time, and measure how big something is. In this lesson, we'll explore ${topic} together and learn how numbers help us every day.`;
            keyConceptsIntro = `Let's discover how ${topic} works. When we understand numbers better, we can solve all kinds of fun puzzles!`;
            example = `Imagine you have 5 apples and your friend gives you 3 more. How many apples do you have now? Let's count together: 5... 6, 7, 8! You have 8 apples. This is how we use ${topic} in real life!`;
            practicePrompt = `Look around your room. Can you count 5 things that are the same color? Try it and tell someone what you found!`;
            vocabulary = ['number', 'count', 'more', 'less', 'equal'];
            summary = `Great job learning about ${topic}! Remember, numbers help us count and understand the world around us.`;
        } else if (complexity === 'moderate') {
            intro = `Understanding ${topic} is a powerful skill that helps us solve real-world problems. From calculating discounts while shopping to figuring out how to share things equally, ${topic} is everywhere in our daily lives.`;
            keyConceptsIntro = `Let's break down the key ideas behind ${topic}. Once you understand these concepts, you'll be able to tackle many different types of problems.`;
            example = `Let's work through an example together. Suppose you're planning a pizza party for 24 people, and each pizza serves 8 people. How many pizzas do you need? We can use ${topic} to find out: 24 ÷ 8 = 3 pizzas. Now you can plan with confidence!`;
            practicePrompt = `Think of a situation in your life where you could use ${topic}. Write down the problem and try to solve it step by step.`;
            vocabulary = ['operation', 'equation', 'solution', 'calculate', 'estimate'];
            summary = `You've learned important concepts about ${topic}. These skills will help you solve problems in math class and in everyday life.`;
        } else {
            intro = `${topic} represents a fundamental area of mathematics with applications across science, engineering, economics, and data analysis. Understanding these concepts deeply will prepare you for advanced mathematical thinking and real-world problem-solving.`;
            keyConceptsIntro = `In this lesson, we'll explore the theoretical foundations and practical applications of ${topic}. You'll develop fluency with multiple representations and problem-solving strategies.`;
            example = `Consider this application: A company's profit P(x) depends on the number of units sold x. If P(x) = 50x - 1000, at what point does the company break even? Setting P(x) = 0 and solving: 50x = 1000, so x = 20 units. This demonstrates how ${topic} applies to business analysis.`;
            practicePrompt = `Create your own real-world scenario where ${topic} could be applied. Formulate the problem mathematically and solve it.`;
            vocabulary = ['function', 'variable', 'expression', 'theorem', 'proof'];
            summary = `You've engaged with ${topic} at a deeper level. Continue to look for connections between mathematical concepts and real-world applications.`;
        }
    } else if (strand.toLowerCase().includes('geometry') || strand.toLowerCase().includes('measurement')) {
        if (complexity === 'simple') {
            intro = `Shapes are everywhere! Look around you - can you see circles, squares, triangles? In this lesson, we'll learn about ${topic} and discover shapes in the world around us.`;
            keyConceptsIntro = `Shapes have special names and features. Let's learn what makes each shape special!`;
            example = `A circle is perfectly round, like a ball or a cookie. A square has 4 equal sides, like a window. Look at a door - what shape is it? It's a rectangle because it has 4 sides, but they're not all the same length!`;
            practicePrompt = `Go on a shape hunt! Find 3 circles, 3 squares, and 3 triangles in your home or classroom. Draw what you find.`;
            vocabulary = ['shape', 'side', 'corner', 'round', 'straight'];
            summary = `You're becoming a shape expert! Keep looking for shapes wherever you go.`;
        } else if (complexity === 'moderate') {
            intro = `${topic} helps us understand and describe the world around us. From architecture to art, geometry and measurement are essential tools for creating and understanding physical spaces.`;
            keyConceptsIntro = `Let's explore the key principles of ${topic}. Understanding these concepts will help you visualize, measure, and create with precision.`;
            example = `Suppose you want to find the area of a rectangular garden that is 12 feet long and 8 feet wide. Area = length × width = 12 × 8 = 96 square feet. This tells you exactly how much space you have for planting!`;
            practicePrompt = `Measure a room in your home. Calculate its area and perimeter. How would you describe this space mathematically?`;
            vocabulary = ['area', 'perimeter', 'angle', 'parallel', 'perpendicular'];
            summary = `You've strengthened your understanding of ${topic}. These measurement and geometry skills have countless real-world applications.`;
        } else {
            intro = `${topic} extends into abstract mathematical thinking and has profound applications in physics, engineering, computer graphics, and design. The concepts you'll explore form the foundation for advanced spatial reasoning.`;
            keyConceptsIntro = `We'll examine ${topic} through multiple lenses: theoretical properties, computational methods, and real-world applications.`;
            example = `Consider finding the volume of a cylinder with radius 5 cm and height 10 cm. Using V = πr²h, we get V = π(5)²(10) = 250π ≈ 785.4 cubic centimeters. This calculation is essential in engineering and manufacturing.`;
            practicePrompt = `Research a real-world application of ${topic} in architecture or engineering. Explain the mathematical principles involved.`;
            vocabulary = ['theorem', 'proof', 'transformation', 'congruence', 'similarity'];
            summary = `You've engaged with ${topic} at an advanced level. These concepts connect to many areas of higher mathematics and applied science.`;
        }
    } else {
        // Generic math content for other strands
        intro = `${topic} is an important area of mathematics that helps us understand patterns, solve problems, and make sense of the world around us.`;
        keyConceptsIntro = `Let's explore the key ideas in ${topic}. Understanding these concepts will give you powerful tools for problem-solving.`;
        example = `Here's how ${topic} works in practice: [This concept helps us analyze and solve problems by applying mathematical reasoning step by step.]`;
        practicePrompt = `Think of a situation where you could apply ${topic}. Try working through a problem on your own.`;
        vocabulary = ['pattern', 'solve', 'reason', 'calculate', 'analyze'];
        summary = `Great work exploring ${topic}! Keep practicing to build your confidence and skills.`;
    }

    return formatStudentContent(topic, strand, grade, 'Mathematics', intro, keyConceptsIntro, example, practicePrompt, vocabulary, summary);
}

function generateScienceContent(topic: string, strand: string, grade: string): string {
    const complexity = getComplexityLevel(grade);

    let intro = '';
    let keyConceptsIntro = '';
    let example = '';
    let practicePrompt = '';
    let vocabulary: string[] = [];
    let summary = '';

    if (strand.toLowerCase().includes('life') || strand.toLowerCase().includes('biology')) {
        if (complexity === 'simple') {
            intro = `Living things are amazing! Plants, animals, and even tiny bugs all need food, water, and air to survive. In this lesson, we'll discover fascinating things about ${topic}!`;
            keyConceptsIntro = `All living things share something special - they grow, change, and need certain things to stay alive.`;
            example = `Think about a butterfly! It starts as a tiny egg, becomes a caterpillar, makes a cocoon, and then becomes a beautiful butterfly. This is called a life cycle, and it shows how living things change and grow.`;
            practicePrompt = `Draw a picture of your favorite animal. What does it need to live? Food? Water? A place to sleep?`;
            vocabulary = ['living', 'grow', 'change', 'need', 'survive'];
            summary = `You learned about ${topic}! All living things are connected and need certain things to thrive.`;
        } else if (complexity === 'moderate') {
            intro = `${topic} explores the incredible diversity of life on Earth. From single-celled organisms to complex ecosystems, life science reveals how living things function, interact, and evolve.`;
            keyConceptsIntro = `Understanding ${topic} helps us appreciate the complexity of living systems and our responsibility to protect them.`;
            example = `Consider photosynthesis: plants use sunlight, water, and carbon dioxide to create glucose (food) and release oxygen. This process is essential for life on Earth - it's why we can breathe!`;
            practicePrompt = `Observe a plant or animal for 10 minutes. Record what you notice about its structure, behavior, or environment.`;
            vocabulary = ['organism', 'ecosystem', 'adaptation', 'cell', 'photosynthesis'];
            summary = `You've explored ${topic} and discovered how living things are interconnected. Keep asking questions about the natural world!`;
        } else {
            intro = `${topic} represents a frontier of modern biological science. From molecular genetics to ecosystem dynamics, these concepts shape our understanding of life itself and inform fields from medicine to environmental science.`;
            keyConceptsIntro = `We'll examine ${topic} through the lens of scientific inquiry, exploring both established principles and current research questions.`;
            example = `DNA replication demonstrates the elegant mechanisms of molecular biology. The double helix unwinds, and each strand serves as a template for a new complementary strand, ensuring genetic information passes accurately to daughter cells.`;
            practicePrompt = `Design a simple experiment to investigate an aspect of ${topic}. Include your hypothesis, variables, and expected outcomes.`;
            vocabulary = ['hypothesis', 'gene', 'evolution', 'metabolism', 'homeostasis'];
            summary = `You've engaged with ${topic} at an advanced level. These concepts form the foundation for understanding life's complexity.`;
        }
    } else if (strand.toLowerCase().includes('physical') || strand.toLowerCase().includes('physics') || strand.toLowerCase().includes('chemistry')) {
        if (complexity === 'simple') {
            intro = `Did you know that everything around you is made of matter? Air, water, your toys, even YOU are made of tiny pieces called matter! Let's explore ${topic} together.`;
            keyConceptsIntro = `Matter can change! Ice melts into water, and water can become steam. These changes happen everywhere.`;
            example = `Push a toy car. It moves! That's because you gave it energy. Pull it back, and it stops. Forces make things move and stop - just like how your legs push the ground to help you walk!`;
            practicePrompt = `Find something that floats and something that sinks. Why do you think one floats and one doesn't?`;
            vocabulary = ['matter', 'solid', 'liquid', 'push', 'pull'];
            summary = `You discovered how ${topic} works! Science is all around us every day.`;
        } else if (complexity === 'moderate') {
            intro = `${topic} explores the fundamental properties of matter and energy. Understanding these concepts helps explain everything from why the sky is blue to how engines work.`;
            keyConceptsIntro = `Physical science reveals the rules that govern our universe. Let's discover the principles behind ${topic}.`;
            example = `Conservation of energy is a fundamental principle: energy cannot be created or destroyed, only transformed. When you drop a ball, its potential energy converts to kinetic energy as it falls, then to sound and heat energy when it bounces.`;
            practicePrompt = `Describe an energy transformation you observe in daily life. What forms of energy are involved?`;
            vocabulary = ['energy', 'force', 'matter', 'atom', 'reaction'];
            summary = `You've explored ${topic} and understand key physical science principles. These ideas explain many everyday phenomena.`;
        } else {
            intro = `${topic} encompasses fundamental principles that govern the physical universe. From quantum mechanics to thermodynamics, these concepts form the basis of modern technology and scientific advancement.`;
            keyConceptsIntro = `We'll analyze ${topic} using mathematical models and experimental evidence, developing a sophisticated understanding of physical phenomena.`;
            example = `Consider Newton's Second Law: F = ma. This elegant equation describes how force, mass, and acceleration are related. A 1000 kg car accelerating at 2 m/s² experiences a net force of 2000 N - fundamental to automotive engineering.`;
            practicePrompt = `Analyze a physical phenomenon using relevant equations. Explain the relationship between variables and predict outcomes.`;
            vocabulary = ['velocity', 'momentum', 'electromagnetic', 'quantum', 'thermodynamic'];
            summary = `You've engaged with ${topic} at a sophisticated level. These principles underpin modern technology and scientific research.`;
        }
    } else if (strand.toLowerCase().includes('earth')) {
        if (complexity === 'simple') {
            intro = `Our Earth is an amazing planet! It has tall mountains, deep oceans, and all kinds of weather. Let's learn about ${topic} and discover cool facts about our world.`;
            keyConceptsIntro = `Earth is always changing - slowly over millions of years and quickly with weather and seasons.`;
            example = `Rain falls from clouds, flows into rivers, and goes to the ocean. The sun heats the ocean, water rises up as vapor, makes clouds, and rains again! This is called the water cycle.`;
            practicePrompt = `Look outside. What's the weather like today? Draw a picture of what you see - sun, clouds, rain?`;
            vocabulary = ['weather', 'season', 'rock', 'water', 'cloud'];
            summary = `You learned about ${topic}! Our Earth is always changing in fascinating ways.`;
        } else {
            intro = `${topic} helps us understand the dynamic systems that shape our planet. From plate tectonics to climate patterns, Earth science reveals the processes that create landscapes, drive weather, and sustain life.`;
            keyConceptsIntro = `Earth operates as an interconnected system. Changes in one area affect others, creating the complex world we observe.`;
            example = `Plate tectonics explains how continents move over millions of years. The Atlantic Ocean widens by about 2.5 cm each year as the Mid-Atlantic Ridge pushes North America and Europe apart.`;
            practicePrompt = `Research a geological feature in your region. How did it form, and what processes continue to shape it?`;
            vocabulary = ['tectonic', 'erosion', 'atmosphere', 'climate', 'geological'];
            summary = `You've explored ${topic} and understand Earth as a dynamic, interconnected system.`;
        }
    } else {
        // Generic science content
        intro = `Science helps us understand how the world works! ${topic} is full of interesting discoveries waiting for us to explore.`;
        keyConceptsIntro = `Scientists ask questions, make observations, and test ideas. Let's think like scientists as we explore ${topic}.`;
        example = `Every scientific discovery starts with a question. Scientists observe, form ideas, and test them through experiments.`;
        practicePrompt = `What question do you have about ${topic}? How could you find the answer?`;
        vocabulary = ['observe', 'experiment', 'discover', 'evidence', 'conclusion'];
        summary = `Great work exploring ${topic}! Keep asking questions - that's how science begins!`;
    }

    return formatStudentContent(topic, strand, grade, 'Science', intro, keyConceptsIntro, example, practicePrompt, vocabulary, summary);
}

function generateELAContent(topic: string, strand: string, grade: string): string {
    const complexity = getComplexityLevel(grade);

    let intro = '';
    let keyConceptsIntro = '';
    let example = '';
    let practicePrompt = '';
    let vocabulary: string[] = [];
    let summary = '';

    if (strand.toLowerCase().includes('reading') || strand.toLowerCase().includes('literature')) {
        if (complexity === 'simple') {
            intro = `Reading is like going on an adventure! When we read, we discover new stories, learn new words, and go to amazing places - all in our imagination. Let's explore ${topic} together!`;
            keyConceptsIntro = `Good readers think about what they're reading. They ask questions, make pictures in their mind, and connect stories to their own life.`;
            example = `When you read about a character who feels scared, think: "Have I ever felt scared too?" This helps you understand the story better and makes reading more fun!`;
            practicePrompt = `Choose your favorite book. What do you like best about it - the characters, the pictures, or the story?`;
            vocabulary = ['story', 'character', 'beginning', 'middle', 'end'];
            summary = `You're becoming a great reader! Keep reading every day to discover new adventures.`;
        } else if (complexity === 'moderate') {
            intro = `${topic} opens doors to new perspectives and deeper understanding. Through reading, we develop empathy, expand our knowledge, and become better thinkers and communicators.`;
            keyConceptsIntro = `Skilled readers use strategies like making predictions, asking questions, and analyzing author's choices. Let's develop these skills with ${topic}.`;
            example = `When reading a mystery, notice how the author plants clues throughout the story. These foreshadowing details create suspense and reward careful readers who piece together the puzzle.`;
            practicePrompt = `Choose a passage from your current reading. Identify three techniques the author uses to engage readers.`;
            vocabulary = ['theme', 'inference', 'perspective', 'conflict', 'resolution'];
            summary = `You've strengthened your skills in ${topic}. Continue to read actively and think critically about texts.`;
        } else {
            intro = `${topic} invites close analysis of how language shapes meaning, identity, and culture. Through literature, we engage with universal human experiences across time periods and perspectives.`;
            keyConceptsIntro = `We'll examine texts through multiple critical lenses, analyzing craft, context, and the interplay between form and meaning.`;
            example = `Consider how Shakespeare uses iambic pentameter in Romeo and Juliet to create rhythm and emphasis. When characters break this pattern, it often signals emotional turmoil or important moments.`;
            practicePrompt = `Select a literary work and analyze how the author's stylistic choices contribute to theme development.`;
            vocabulary = ['rhetoric', 'motif', 'archetype', 'literary criticism', 'syntax'];
            summary = `You've engaged with ${topic} at a sophisticated level. Continue to explore how literature reflects and shapes human experience.`;
        }
    } else if (strand.toLowerCase().includes('writing')) {
        if (complexity === 'simple') {
            intro = `Writing helps us share our ideas with others! When we write, we can tell stories, share facts, or express our feelings. Let's learn about ${topic}!`;
            keyConceptsIntro = `Good writers think before they write. They decide what to say, put their ideas in order, and use their best handwriting or typing.`;
            example = `To write a good sentence, start with a capital letter and end with a period. "The cat is sleeping." See? That's a complete sentence that tells us something!`;
            practicePrompt = `Write three sentences about your favorite thing to do. Remember capitals and periods!`;
            vocabulary = ['sentence', 'word', 'capital', 'period', 'idea'];
            summary = `You're learning to be a writer! Every time you write, you get better.`;
        } else if (complexity === 'moderate') {
            intro = `${topic} empowers you to communicate effectively for different purposes and audiences. Strong writers can inform, persuade, entertain, and express themselves clearly.`;
            keyConceptsIntro = `The writing process involves planning, drafting, revising, and editing. Each stage helps you develop and refine your ideas.`;
            example = `A strong thesis statement guides your entire essay. Instead of "I'm going to write about recycling," try "Recycling reduces landfill waste and conserves natural resources, making it essential for environmental sustainability."`;
            practicePrompt = `Choose a topic you care about. Write a thesis statement and three supporting points.`;
            vocabulary = ['thesis', 'evidence', 'transition', 'revision', 'audience'];
            summary = `You've developed your skills in ${topic}. Remember that good writing takes time and revision.`;
        } else {
            intro = `${topic} encompasses sophisticated composition for academic, professional, and creative contexts. Effective writers adapt their voice, structure, and rhetorical strategies to achieve specific purposes.`;
            keyConceptsIntro = `We'll explore advanced techniques in ${topic}, including argumentation, synthesis of sources, and stylistic refinement.`;
            example = `Effective argumentation acknowledges counterarguments while presenting compelling evidence. This ethical approach builds credibility and demonstrates nuanced thinking.`;
            practicePrompt = `Draft an argumentative piece that integrates multiple sources and addresses counterarguments.`;
            vocabulary = ['rhetoric', 'synthesis', 'counterargument', 'ethos', 'logos'];
            summary = `You've engaged with ${topic} at an advanced level. Continue refining your written voice and argumentation skills.`;
        }
    } else {
        // Generic ELA content
        intro = `Language is powerful! Through reading, writing, speaking, and listening, we connect with others and express ourselves. Let's explore ${topic}!`;
        keyConceptsIntro = `Strong communicators think carefully about their words and how they use them.`;
        example = `Whether you're reading a book, writing a story, or talking to a friend, you're using language skills that will help you all your life.`;
        practicePrompt = `Practice using language today. Read something new, write a note, or have a conversation!`;
        vocabulary = ['communicate', 'express', 'language', 'meaning', 'understand'];
        summary = `Great work with ${topic}! Every time you use language, you're building important skills.`;
    }

    return formatStudentContent(topic, strand, grade, 'English Language Arts', intro, keyConceptsIntro, example, practicePrompt, vocabulary, summary);
}

function generateSocialStudiesContent(topic: string, strand: string, grade: string): string {
    const complexity = getComplexityLevel(grade);

    let intro = '';
    let keyConceptsIntro = '';
    let example = '';
    let practicePrompt = '';
    let vocabulary: string[] = [];
    let summary = '';

    if (complexity === 'simple') {
        intro = `People live in families, neighborhoods, and communities all over the world! We all have stories, traditions, and ways of helping each other. Let's learn about ${topic}!`;
        keyConceptsIntro = `Understanding ${topic} helps us be good neighbors and citizens who care about others.`;
        example = `In every community, people have jobs that help others. Firefighters keep us safe, teachers help us learn, and doctors help us stay healthy. Everyone has an important role!`;
        practicePrompt = `Who are the helpers in your community? Draw a picture of someone who helps others.`;
        vocabulary = ['community', 'family', 'helper', 'rule', 'share'];
        summary = `You learned about ${topic}! We all live together and help each other.`;
    } else if (complexity === 'moderate') {
        intro = `${topic} helps us understand how societies function, how they've changed over time, and how we can be informed, engaged citizens. Studying ${topic} connects us to the larger human story.`;
        keyConceptsIntro = `Social studies involves examining evidence, considering multiple perspectives, and understanding cause and effect in human societies.`;
        example = `The American Revolution didn't happen suddenly - it resulted from decades of growing tensions between colonists and British rule. Taxes, representation, and ideas about rights all played a role.`;
        practicePrompt = `Research a current event related to ${topic}. What different perspectives exist? What historical context is important?`;
        vocabulary = ['government', 'citizen', 'economy', 'culture', 'history'];
        summary = `You've explored ${topic} and developed skills for understanding our complex world.`;
    } else {
        intro = `${topic} represents critical inquiry into human societies, institutions, and global systems. Understanding these concepts prepares you for informed citizenship and engagement with complex contemporary issues.`;
        keyConceptsIntro = `We'll analyze ${topic} using primary sources, scholarly perspectives, and frameworks for understanding social, political, and economic dynamics.`;
        example = `Comparative analysis of political systems reveals how different societies balance individual rights with collective welfare. Understanding these tradeoffs illuminates current policy debates.`;
        practicePrompt = `Develop an argument about a current issue related to ${topic}, supporting your position with historical evidence and multiple sources.`;
        vocabulary = ['sovereignty', 'ideology', 'institution', 'globalization', 'primary source'];
        summary = `You've engaged with ${topic} at an advanced level. Apply these analytical skills to understand and engage with contemporary issues.`;
    }

    return formatStudentContent(topic, strand, grade, 'Social Studies', intro, keyConceptsIntro, example, practicePrompt, vocabulary, summary);
}

function generateElectivesContent(topic: string, strand: string, grade: string): string {
    const complexity = getComplexityLevel(grade);

    let intro = '';
    let keyConceptsIntro = '';
    let example = '';
    let practicePrompt = '';
    let vocabulary: string[] = [];
    let summary = '';

    if (strand.toLowerCase().includes('art') || strand.toLowerCase().includes('music')) {
        if (complexity === 'simple') {
            intro = `Art and music let us express ourselves in creative ways! When we paint, draw, sing, or play instruments, we share our feelings and ideas. Let's explore ${topic}!`;
            keyConceptsIntro = `Everyone can be creative! There's no wrong way to express yourself through art and music.`;
            example = `Colors can show feelings. Bright yellow might feel happy, while blue might feel calm. Artists choose colors to share how they feel!`;
            practicePrompt = `Create something! Draw a picture, make up a song, or dance to your favorite music.`;
            vocabulary = ['create', 'color', 'sound', 'rhythm', 'imagination'];
            summary = `You explored ${topic}! Keep being creative every day.`;
        } else {
            intro = `${topic} offers opportunities for creative expression, cultural understanding, and skill development. The arts enrich our lives and help us see the world from new perspectives.`;
            keyConceptsIntro = `Let's explore techniques, history, and the creative process related to ${topic}.`;
            example = `Understanding composition helps create balanced, engaging artwork. The rule of thirds suggests placing focal points along imaginary lines dividing your space into nine sections.`;
            practicePrompt = `Create a piece related to ${topic}. Reflect on your creative choices and process.`;
            vocabulary = ['composition', 'technique', 'expression', 'medium', 'interpretation'];
            summary = `You've developed skills in ${topic}. Continue exploring and expressing your creativity.`;
        }
    } else if (strand.toLowerCase().includes('health') || strand.toLowerCase().includes('physical')) {
        if (complexity === 'simple') {
            intro = `Our bodies need care to stay healthy and strong! Eating good food, playing actively, and getting enough sleep all help us feel our best. Let's learn about ${topic}!`;
            keyConceptsIntro = `Taking care of yourself means making healthy choices every day.`;
            example = `Move your body every day! Running, jumping, dancing, or playing sports makes your heart strong and helps you feel happy.`;
            practicePrompt = `What's your favorite way to move and play? Do it for at least 20 minutes today!`;
            vocabulary = ['healthy', 'exercise', 'nutrition', 'rest', 'strong'];
            summary = `You learned about ${topic}! Keep making healthy choices every day.`;
        } else {
            intro = `${topic} provides knowledge and skills for lifelong health and wellness. Understanding how our bodies and minds work helps us make informed decisions.`;
            keyConceptsIntro = `Health encompasses physical, mental, and social well-being. Let's explore how ${topic} contributes to overall wellness.`;
            example = `Regular physical activity improves cardiovascular health, boosts mood, and enhances cognitive function. Even 30 minutes of moderate activity daily makes a significant difference.`;
            practicePrompt = `Create a personal wellness plan that addresses physical activity, nutrition, and stress management.`;
            vocabulary = ['wellness', 'cardiovascular', 'nutrition', 'stress', 'mental health'];
            summary = `You've explored ${topic} and understand its role in overall wellness.`;
        }
    } else if (strand.toLowerCase().includes('financial') || strand.toLowerCase().includes('technology')) {
        intro = `${topic} provides practical skills that will serve you throughout your life. Understanding these concepts helps you make informed decisions and achieve your goals.`;
        keyConceptsIntro = `Let's explore the key principles and skills related to ${topic}.`;
        example = `Budgeting involves tracking income and expenses to ensure you're spending less than you earn. A simple budget divides spending into needs, wants, and savings.`;
        practicePrompt = `Apply what you've learned about ${topic} to a real-life situation or scenario.`;
        vocabulary = ['budget', 'goal', 'decision', 'plan', 'skill'];
        summary = `You've developed practical knowledge about ${topic}. Apply these skills in your daily life.`;
    } else {
        // Generic electives content
        intro = `${topic} offers an opportunity to explore new interests and develop valuable skills. Electives let you pursue subjects you're passionate about!`;
        keyConceptsIntro = `Let's dive into the key ideas and skills related to ${topic}.`;
        example = `Learning new skills takes practice. Whether it's art, music, coding, or cooking, every expert started as a beginner!`;
        practicePrompt = `Practice what you've learned about ${topic}. Set a goal and work toward it!`;
        vocabulary = ['skill', 'practice', 'explore', 'create', 'goal'];
        summary = `Great work exploring ${topic}! Keep pursuing your interests and developing new skills.`;
    }

    return formatStudentContent(topic, strand, grade, 'Electives', intro, keyConceptsIntro, example, practicePrompt, vocabulary, summary);
}

function formatStudentContent(
    topic: string,
    strand: string,
    grade: string,
    subject: string,
    intro: string,
    keyConceptsIntro: string,
    example: string,
    practicePrompt: string,
    vocabulary: string[],
    summary: string
): string {
    const estimatedTime = getComplexityLevel(grade) === 'simple' ? '15-20' : getComplexityLevel(grade) === 'moderate' ? '25-35' : '40-50';

    return `# ${topic}

**Grade:** ${grade} | **Subject:** ${subject} | **Estimated Time:** ${estimatedTime} minutes

## What You'll Learn
${generateLearningGoalsForContent(subject, strand, topic, grade)}

---

## Introduction

${intro}

## Key Concepts

${keyConceptsIntro}

### Understanding ${topic}

${example}

## Let's Practice

${practicePrompt}

## Key Vocabulary

${vocabulary.map(term => `- **${term.charAt(0).toUpperCase() + term.slice(1)}:** A key term related to ${topic}`).join('\n')}

## Summary

${summary}

## Going Further

Explore more about ${topic}:
- Ask your teacher or tutor for additional resources
- Look for videos and interactive activities
- Discuss what you've learned with classmates or family
`;
}

function generateLearningGoalsForContent(_subject: string, _strand: string, topic: string, grade: string): string {
    const complexity = getComplexityLevel(grade);
    let goals: string[] = [];

    if (complexity === 'simple') {
        goals = [
            `Discover what ${topic} is all about`,
            `Try some fun activities with ${topic}`,
            `Share what you learned`
        ];
    } else if (complexity === 'moderate') {
        goals = [
            `Understand the key concepts of ${topic}`,
            `Apply what you learn to real-world examples`,
            `Explain your thinking and connect ideas`
        ];
    } else {
        goals = [
            `Analyze and evaluate concepts related to ${topic}`,
            `Apply sophisticated reasoning and problem-solving`,
            `Synthesize ideas and make connections across disciplines`
        ];
    }

    return goals.map(g => `- ${g}`).join('\n');
}

async function fetchLessons(): Promise<LessonRecord[]> {
    const allLessons: LessonRecord[] = [];
    let start = 0;
    const pageSize = 500;

    while (true) {
        const { data, error } = await supabase
            .from('lessons')
            .select('id, title, content, module_id, modules(grade_band, subject, strand, topic)')
            .range(start, start + pageSize - 1);

        if (error) {
            throw new Error(`Failed to fetch lessons: ${error.message}`);
        }

        if (!data || data.length === 0) break;

        allLessons.push(...(data as unknown as LessonRecord[]));
        start += pageSize;

        if (data.length < pageSize) break;
    }

    return allLessons;
}

async function updateLessonContent(id: number, content: string): Promise<void> {
    const { error } = await supabase
        .from('lessons')
        .update({ content })
        .eq('id', id);

    if (error) {
        throw new Error(`Failed to update lesson ${id}: ${error.message}`);
    }
}

function isTeacherGuideContent(content: string): boolean {
    // Check if content has teacher-facing language
    const teacherPatterns = [
        /students?\s+(will|should|can)\s+(note|observe|discuss|share|complete)/i,
        /model\s+(one|a|the|thinking)/i,
        /invite\s+students/i,
        /pose\s+a\s+(context|question|prompt)/i,
        /quick\s+(estimate|claim)/i,
        /walk\s+through\s+(one|an?)\s+(concrete|example)/i,
        /collect\s+(thumbs|responses)/i,
        /assign\s+(a|an?|the)/i,
        /groups?\s+(annotate|tackle|draft)/i,
    ];

    let matchCount = 0;
    for (const pattern of teacherPatterns) {
        if (pattern.test(content)) {
            matchCount++;
        }
    }

    // If 2 or more teacher-facing patterns found, it's likely a teacher guide
    return matchCount >= 2;
}

async function main() {
    console.log('=== PHASE 2: GENERATE STUDENT-FACING CONTENT ===\n');

    const previewMode = process.argv.includes('--preview');
    const dryRun = process.argv.includes('--dry-run');
    const subjectFilter = process.argv.find(arg => arg.startsWith('--subject='))?.split('=')[1];
    const limit = parseInt(process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '0');

    console.log('Fetching all lessons...\n');
    const allLessons = await fetchLessons();
    console.log(`Found ${allLessons.length} total lessons\n`);

    // Filter to lessons that need student content transformation
    let lessons = allLessons.filter(lesson => {
        if (!lesson.modules) return false;
        if (!lesson.content) return true; // Empty content needs transformation

        // Check if it's teacher guide content
        return isTeacherGuideContent(lesson.content);
    });

    // Apply subject filter
    if (subjectFilter) {
        lessons = lessons.filter(l =>
            l.modules?.subject.toLowerCase().includes(subjectFilter.toLowerCase())
        );
        console.log(`Filtered to ${subjectFilter}: ${lessons.length} lessons\n`);
    }

    // Apply limit
    if (limit > 0) {
        lessons = lessons.slice(0, limit);
        console.log(`Limited to ${limit} lessons\n`);
    }

    console.log(`Found ${lessons.length} lessons needing student content transformation\n`);

    if (lessons.length === 0) {
        console.log('✅ All lessons already have student-facing content!');
        return;
    }

    if (previewMode) {
        console.log('📋 PREVIEW MODE - showing first 3 transformations:\n');
        for (const lesson of lessons.slice(0, 3)) {
            const module = lesson.modules!;
            const generator = CONTENT_TEMPLATES[module.subject] || CONTENT_TEMPLATES['Electives'];
            const newContent = generator(
                module.topic || lesson.title.replace(/^(Intro:|Launch Lesson:)\s*/i, ''),
                module.strand || 'General',
                module.grade_band
            );

            console.log('='.repeat(60));
            console.log(`ID: ${lesson.id} | ${lesson.title}`);
            console.log(`Subject: ${module.subject} | Grade: ${module.grade_band}`);
            console.log('-'.repeat(60));
            console.log('NEW CONTENT PREVIEW (first 1000 chars):');
            console.log(newContent.substring(0, 1000));
            console.log('...\n');
        }
        console.log('\nRun without --preview to apply changes.');
        return;
    }

    // Process and update lessons
    let successCount = 0;
    let errorCount = 0;
    const errors: { id: number; error: string }[] = [];

    console.log(dryRun ? '🔍 DRY RUN MODE - no changes will be saved\n' : '🚀 Transforming lessons...\n');

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        const module = lesson.modules!;

        try {
            const generator = CONTENT_TEMPLATES[module.subject] || CONTENT_TEMPLATES['Electives'];
            const newContent = generator(
                module.topic || lesson.title.replace(/^(Intro:|Launch Lesson:)\s*/i, ''),
                module.strand || 'General',
                module.grade_band
            );

            if (!dryRun) {
                await updateLessonContent(lesson.id, newContent);
            }

            successCount++;

            if ((i + 1) % 50 === 0 || i === lessons.length - 1) {
                console.log(`Progress: ${i + 1}/${lessons.length} (${successCount} transformed, ${errorCount} errors)`);
            }
        } catch (err) {
            errorCount++;
            errors.push({ id: lesson.id, error: String(err) });
        }
    }

    // Summary
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total processed: ${lessons.length}`);
    console.log(`Successfully transformed: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
        console.log('\n⚠️ Errors:');
        for (const err of errors.slice(0, 10)) {
            console.log(`  Lesson ${err.id}: ${err.error}`);
        }
    }

    if (dryRun) {
        console.log('\n📝 This was a DRY RUN. Run without --dry-run to apply changes.');
    } else {
        console.log('\n✅ Student-facing content has been generated!');
    }
}

main().catch(console.error);
