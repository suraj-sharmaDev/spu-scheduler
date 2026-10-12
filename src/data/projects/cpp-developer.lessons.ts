import type { LessonPlan } from "#/lib/tracker/lessons";

/**
 * Weeks 1–3 of the C++ plan, rewritten as worked-example lessons. They replace
 * the workbook's weeks 1–2. Rules: at most 2 new concepts a session; every
 * example uses the same café app, so the pattern is new but the setting isn't;
 * the labels on example chunks repeat, so she has something to hang them on.
 */
export const cppLessons: LessonPlan = {
	replaces: ["w1", "w2"],
	milestones: [
		{
			id: "lw1",
			subproject: "Student Manager",
			bigQuestion: "How do I turn a real-world problem into a program?",
			outcome: "A menu that keeps coming back, and a plan for the app.",
			guidance: "Worked examples",
		},
		{
			id: "lw2",
			subproject: "Student Manager",
			bigQuestion: "How does a program remember things?",
			outcome: "Add students and see every one of them.",
			guidance: "Worked examples",
		},
		{
			id: "lw3",
			subproject: "Student Manager",
			bigQuestion: "How does a program find, change and remove things?",
			outcome: "Search, update and delete working.",
			guidance: "Worked examples",
		},
	],
	guide: [
		{
			title: "How to do one session",
			items: [
				{
					label: "1. Remember (5 min)",
					text: "A few questions from earlier sessions. Guess first, then look. Getting one wrong is fine: it comes back later.",
				},
				{
					label: "2. Watch (10 min)",
					text: "Read the example top to bottom. Guess what it does, then type it in and run it.",
				},
				{
					label: "3. Put it in order (5 min)",
					text: "Arrange the mixed-up lines. It's practice; nothing is saved.",
				},
				{
					label: "4. Build (20 min)",
					text: "One step at a time. Stuck for 5 minutes? Tap 'Need a hint?'. The example is always one tap away.",
				},
				{
					label: "5. Check (5 min)",
					text: "Tick each check only when it's really true.",
				},
				{
					label: "6. Say it back (2 min)",
					text: "Without looking, write one sentence about what you learned. Your next session starts with it.",
				},
			],
		},
	],
	tasks: [
		// --- week 1 -------------------------------------------------------------
		{
			id: "l1",
			milestoneId: "lw1",
			title: "Say hello and ask a question",
			goal: "A program that greets you and repeats back a number you type.",
			level: 1,
			concepts: ["console-program", "variable-type"],
			steps: [
				{
					text: "Create a new C++ console project called StudentManager.",
					hint: {
						text: "In your editor: New Project → Console App (C++). Name it StudentManager. It creates a main.cpp file for you.",
					},
				},
				{
					text: "Make it print: Welcome to Student Manager!",
					hint: {
						text: "Same as the 'Show text' part of the example.",
						code: `cout << "Welcome to Student Manager!" << endl;`,
					},
				},
				{
					text: "Ask 'How many students?' and read a whole number.",
					hint: {
						text: "Same as the 'Read a number' part of the example.",
						code: `cout << "How many students? ";
int count;
cin >> count;`,
					},
				},
				{
					text: "Print it back, like: You have 12 students.",
					hint: {
						text: "Text goes in quotes; the box name doesn't.",
						code: `cout << "You have " << count << " students." << endl;`,
					},
				},
				{
					text: "Also print the number doubled: Two classes would have 24.",
					stretch: true,
				},
			],
			doneWhen: [
				"It runs and shows the welcome.",
				"Typing 12 prints 'You have 12 students.'",
				"Check: try 0 and try 100.",
			],
			lesson: {
				why: "Every app you'll ever build starts here: show something, read something, answer.",
				example: {
					title: "A café that asks how many cups",
					blocks: [
						{
							label: "Setup",
							code: `#include <iostream>
using namespace std;`,
						},
						{ label: "Start the program", code: "int main() {" },
						{
							label: "Show text",
							code: `    cout << "Welcome to the Rose Café!" << endl;
    cout << "How many cups? ";`,
						},
						{
							label: "Read a number",
							code: `    int cups;
    cin >> cups;`,
						},
						{
							label: "Answer",
							code: `    cout << "Coming up: " << cups << " cups." << endl;`,
						},
						{
							label: "End",
							code: `    return 0;
}`,
						},
					],
					predict: {
						question: "You type 3. What exactly does the last line print?",
						answer:
							"Coming up: 3 cups. The words in quotes are printed as they are; cups is swapped for the number inside it.",
					},
				},
				order: {
					prompt: "A program that reads your age and prints it plus one.",
					lines: [
						"int main() {",
						"    int age;",
						"    cin >> age;",
						"    cout << age + 1 << endl;",
						"    return 0;",
						"}",
					],
				},
				recall: [
					{
						q: "What does cout do?",
						a: 'Shows text on the screen. cout << "Hi"; prints Hi.',
					},
					{
						q: "What does cin >> x do?",
						a: "Waits for you to type something, then stores it in x.",
					},
					{
						q: "What kind of value does an int hold?",
						a: "A whole number, like 3 or 120. No decimals.",
					},
				],
			},
		},
		{
			id: "l2",
			milestoneId: "lw1",
			title: "Choose with if",
			goal: "A menu that tells you which option you picked.",
			level: 1,
			concepts: ["condition", "compiler-error"],
			steps: [
				{
					text: "Print the menu: 1 Add, 2 View all, 3 Search, 4 Update, 5 Delete, 0 Exit.",
					hint: {
						text: "One cout line per option, like the café menu. End with 'Choose: '.",
						code: `cout << "1. Add" << endl;
cout << "2. View all" << endl;
// ...and so on
cout << "Choose: ";`,
					},
				},
				{
					text: "Read the choice into an int.",
					hint: {
						text: "Same as the 'Read the choice' part of the example.",
						code: `int choice;
cin >> choice;`,
					},
				},
				{
					text: "Print 'You chose: Add' for 1, 'You chose: View all' for 2, and so on.",
					hint: {
						text: "One if / else if per option. Compare with == (two equals signs).",
						code: `if (choice == 1) {
    cout << "You chose: Add" << endl;
} else if (choice == 2) {
    cout << "You chose: View all" << endl;
}`,
					},
				},
				{
					text: "For any other number, print 'Not on the menu.'",
					hint: {
						text: "A last else catches everything you didn't list.",
						code: `} else {
    cout << "Not on the menu." << endl;
}`,
					},
				},
				{
					text: "If the build shows errors, read only the FIRST one, fix it, and build again.",
					hint: {
						text: "One missing ; can cause ten errors. The first one is usually the real problem. Look at the line number it gives you.",
					},
				},
			],
			doneWhen: [
				"Each of 0–5 prints the right message.",
				"Check: 7 and -1 say 'Not on the menu.'",
			],
			lesson: {
				why: "Programs seem smart because they choose. 'If this, do that' is how.",
				example: {
					title: "The café menu",
					blocks: [
						{
							label: "Show the menu",
							code: `    cout << "1. Tea" << endl;
    cout << "2. Coffee" << endl;
    cout << "0. Leave" << endl;
    cout << "Choose: ";`,
						},
						{
							label: "Read the choice",
							code: `    int choice;
    cin >> choice;`,
						},
						{
							label: "Decide what to do",
							code: `    if (choice == 1) {
        cout << "One tea, coming up." << endl;
    } else if (choice == 2) {
        cout << "One coffee, coming up." << endl;
    } else if (choice == 0) {
        cout << "Bye!" << endl;
    } else {
        cout << "That's not on the menu." << endl;
    }`,
						},
					],
					predict: {
						question: "What does it print if you type 7?",
						answer:
							"That's not on the menu. None of the tests are true, so the last else runs.",
					},
				},
				order: {
					prompt: "1 means tea, 2 means coffee, anything else isn't on the menu.",
					lines: [
						"if (choice == 1) {",
						'    cout << "Tea" << endl;',
						"} else if (choice == 2) {",
						'    cout << "Coffee" << endl;',
						"} else {",
						'    cout << "Not on the menu" << endl;',
						"}",
					],
				},
				recall: [
					{
						q: "What's the difference between = and ==?",
						a: "= puts a value in a box (x = 5). == asks a question: are these equal? (x == 5)",
					},
					{
						q: "When does the last else run?",
						a: "When none of the if / else if tests were true.",
					},
					{
						q: "The build shows 12 errors. Which one do you read?",
						a: "The first one. Fix it and build again; many of the others often disappear.",
					},
				],
			},
		},
		{
			id: "l3",
			milestoneId: "lw1",
			title: "Keep going with a loop",
			goal: "The menu keeps coming back until you choose 0.",
			level: 2,
			concepts: ["loop"],
			steps: [
				{
					text: "Before the menu, make choice and set it to -1.",
					hint: {
						text: "It has to start as something that isn't 0, or the loop would never run.",
						code: "int choice = -1;",
					},
				},
				{
					text: "Put the menu, the cin and all the ifs inside while (choice != 0) { ... }.",
					hint: {
						text: "Everything that should repeat goes between { and }. Inside the loop, write cin >> choice; without int in front: int makes a second, separate box, and the loop would never stop.",
						code: `int choice = -1;
while (choice != 0) {
    // show the menu
    cin >> choice;
    // the ifs
}`,
					},
				},
				{
					text: "After the loop ends, print 'Goodbye!'.",
					hint: {
						text: "Put the cout after the loop's closing }.",
					},
				},
				{
					text: "Print a blank line after each answer so the screen is easier to read.",
					stretch: true,
				},
			],
			doneWhen: [
				"The menu comes back after every choice.",
				"0 says Goodbye! and the program ends.",
				"Check: type 7, then 2, then 0.",
			],
			lesson: {
				why: "Real apps don't quit after one click. A loop keeps them running.",
				example: {
					title: "A café that keeps taking orders",
					blocks: [
						{
							label: "Start with a choice that isn't 0",
							code: "    int choice = -1;",
						},
						{
							label: "Repeat until they choose 0",
							code: "    while (choice != 0) {",
						},
						{
							label: "Show the menu and read the choice",
							code: `        cout << "1. Tea  2. Coffee  0. Leave" << endl;
        cout << "Choose: ";
        cin >> choice;`,
						},
						{
							label: "Decide what to do",
							code: `        if (choice == 1) {
            cout << "One tea." << endl;
        } else if (choice == 2) {
            cout << "One coffee." << endl;
        }
    }`,
						},
						{
							label: "After the loop",
							code: `    cout << "Bye!" << endl;`,
						},
					],
					predict: {
						question:
							"You type 1, then 2, then 0. How many times does the menu appear?",
						answer:
							"3 times. Menu, you pick 1. Menu, you pick 2. Menu, you pick 0, and the loop ends.",
					},
				},
				order: {
					prompt:
						"Keep asking until they type 0, then say Bye! once at the end.",
					lines: [
						"int choice = -1;",
						"while (choice != 0) {",
						'    cout << "Choose: ";',
						"    cin >> choice;",
						"}",
						'cout << "Bye!" << endl;',
					],
				},
				recall: [
					{
						q: "What does while (choice != 0) { ... } do?",
						a: "Repeats the code inside { } as long as choice is not 0.",
					},
					{
						q: "Why does choice start as -1?",
						a: "So the test is true the first time and the loop runs at least once.",
					},
					{ q: "What does != mean?", a: "Not equal." },
				],
			},
		},
		{
			id: "l4",
			milestoneId: "lw1",
			title: "Plan before you build",
			goal: "A short plan: what the app must do, and what it stores about each student.",
			level: 1,
			concepts: ["requirements", "data-model"],
			steps: [
				"Create requirements.txt in your project folder.",
				{
					text: "Write the 5 features (Add, View all, Search, Update, Delete) in your own words, one line each.",
					hint: {
						text: "Pretend you're explaining the app to a friend.",
						code: "Add: put a new student into the app.",
					},
				},
				{
					text: "Under each feature, write Input: and Output:, like the café plan.",
					hint: {
						text: "Input = what the user types. Output = what they see back.",
						code: `Add
  Input: ID, name, age, major, GPA
  Output: "Student added."`,
					},
				},
				{
					text: "Write the data model: ID, name, age, major, GPA. Next to each, write whole number, decimal or text.",
					hint: {
						text: "Is it words? Text. Can it have a dot, like 3.7? Decimal. Otherwise it's a whole number.",
					},
				},
			],
			doneWhen: [
				"requirements.txt has 5 features, each with Input and Output.",
				"The data model lists 5 fields, each with its kind.",
			],
			lesson: {
				why: "Ten minutes of planning saves an hour of building the wrong thing.",
				example: {
					title: "The café app's plan",
					blocks: [
						{
							label: "What it must do (requirements)",
							code: `1. Take an order
   Input: the drink and how many cups
   Output: "Order 12: 2 x Tea"
2. See all orders
   Input: nothing
   Output: every order, one per line`,
						},
						{
							label: "What it stores (data model)",
							code: `Order:
  number   whole number   12
  drink    text           Tea
  cups     whole number   2
  price    decimal        3.50`,
						},
					],
					predict: {
						question: "Why is price a decimal but cups a whole number?",
						answer: "You can pay 3.50, but you can't order 2.5 cups.",
					},
				},
				order: null,
				recall: [
					{
						q: "What's a requirement?",
						a: "One thing the app must do, from the user's point of view. 'Search for a student by ID.'",
					},
					{
						q: "What kind of value is a GPA like 3.7?",
						a: "A decimal (double in C++).",
					},
					{
						q: "What kind of value is a major like Biology?",
						a: "Text (string in C++).",
					},
				],
			},
		},
		{
			id: "l5",
			milestoneId: "lw1",
			title: "Review week 1",
			goal: "Everything from this week still works, and you can explain it.",
			level: 1,
			checkpoint: true,
			concepts: [],
			steps: [
				"Run your menu. Try every option, then 7, then 0.",
				"Open requirements.txt. Does it still say what you want? Fix anything that doesn't.",
				{
					text: "Back up: copy your project folder and name the copy StudentManager_W1.",
					hint: {
						text: "In Finder: right-click the folder → Duplicate, then rename the copy.",
					},
				},
				"Fill in this week's reflection (Reflect tab).",
				{ text: "Do a stretch goal you skipped this week.", stretch: true },
			],
			doneWhen: [
				"The menu works for every option.",
				"Backup made.",
				"Reflection written.",
			],
			lesson: {
				why: "Coming back to things is how they stick. That's what today is for.",
				example: null,
				order: null,
				recall: [],
			},
		},

		// --- week 2 -------------------------------------------------------------
		{
			id: "l6",
			milestoneId: "lw2",
			title: "A student in code",
			goal: "Choosing Add asks for a student's details and prints them back.",
			level: 2,
			concepts: ["struct", "std-string"],
			steps: [
				{
					text: "Add #include <string> at the top.",
					hint: { text: "Text lives in its own library, next to <iostream>." },
				},
				{
					text: "Above main, write struct Student with: id (int), name (string), age (int), major (string), gpa (double).",
					hint: {
						text: "Like struct Order in the example. Don't forget the ; after the last }.",
						code: `struct Student {
    int id;
    string name;
    int age;
    string major;
    double gpa;
};`,
					},
				},
				{
					text: "When the user picks 1 (Add), make a Student and ask for each value.",
					hint: {
						text: "Copy the 'Fill one in' part of the example and change the names. Use getline(cin >> ws, ...) for name and major, because they can have spaces.",
						code: `Student s;
cout << "ID: ";
cin >> s.id;
cout << "Name: ";
getline(cin >> ws, s.name);
// age, major and gpa the same way`,
					},
				},
				{
					text: "Print the student back on one line, like: 101 | Priya Sharma | 19 | Biology | 3.7",
					hint: {
						code: `cout << s.id << " | " << s.name << " | " << s.age
     << " | " << s.major << " | " << s.gpa << endl;`,
						text: "One << between each piece.",
					},
				},
			],
			doneWhen: [
				"Add asks for all 5 values and prints them back.",
				"Check: a name with a space (Priya Sharma); GPA 0 and 4.",
			],
			lesson: {
				why: "Real things have many details. A struct keeps them together, like a form.",
				example: {
					title: "An order in code",
					blocks: [
						{
							label: "Setup",
							code: `#include <iostream>
#include <string>
using namespace std;`,
						},
						{
							label: "Describe an order (above main)",
							code: `struct Order {
    int number;
    string drink;
    int cups;
    double price;
};`,
						},
						{
							label: "Fill one in",
							code: `    Order o;
    cout << "Order number: ";
    cin >> o.number;
    cout << "Drink: ";
    getline(cin >> ws, o.drink);
    cout << "Cups: ";
    cin >> o.cups;
    cout << "Price: ";
    cin >> o.price;`,
						},
						{
							label: "Print it back",
							code: `    cout << o.number << ": " << o.cups << " x " << o.drink
         << " (" << o.price << ")" << endl;`,
						},
					],
					predict: {
						question:
							"The drink is Iced Tea (two words). Why does the example use getline(cin >> ws, o.drink) instead of cin >> o.drink?",
						answer:
							"cin >> stops at the first space, so it would only read 'Iced'. getline reads the whole line. The ws skips the Enter left over from the answer before.",
					},
				},
				order: {
					prompt: "Make a pet, ask for its name first, then its age.",
					lines: [
						"Pet p;",
						'cout << "Name: ";',
						"getline(cin >> ws, p.name);",
						'cout << "Age: ";',
						"cin >> p.age;",
					],
				},
				recall: [
					{
						q: "What is a struct?",
						a: "Your own type that groups related values, like a form with fields.",
					},
					{
						q: "How do you get the name out of a Student called s?",
						a: "s.name. The dot opens the form and picks one field.",
					},
					{
						q: "Why getline(cin >> ws, name) and not cin >> name?",
						a: "cin >> stops at a space. getline reads the whole line, so 'Priya Sharma' works.",
					},
				],
			},
		},
		{
			id: "l7",
			milestoneId: "lw2",
			title: "Remember many students",
			goal: "Add as many students as you like; View all shows every one.",
			level: 2,
			concepts: ["vector", "single-source-of-truth"],
			steps: [
				"Add #include <vector> at the top.",
				{
					text: "Before the while loop, make an empty list: vector<Student> students;",
					hint: {
						text: "It must be before the loop. Made inside the loop, it would start empty every time the menu comes back.",
					},
				},
				{
					text: "In Add, after filling in the student, put them in the list.",
					hint: { code: "students.push_back(s);" },
				},
				{
					text: "In View all (2), print every student with a for loop.",
					hint: {
						text: "Like 'Go through every item' in the example.",
						code: `for (Student s : students) {
    cout << s.id << " | " << s.name << endl;
}`,
					},
				},
				{
					text: "If the list is empty, View all prints 'No students yet.'",
					hint: {
						code: `if (students.empty()) {
    cout << "No students yet." << endl;
}`,
					},
				},
				{
					text: "Print a count at the end: 3 students. (students.size() gives the count.)",
					stretch: true,
				},
			],
			doneWhen: [
				"Add 3 students; View all shows all 3 in the order you added them.",
				"View all with no students says 'No students yet.'",
			],
			lesson: {
				why: "One student isn't an app. A list lets the program remember everyone.",
				example: {
					title: "A list of orders",
					blocks: [
						{ label: "Setup", code: "#include <vector>" },
						{
							label: "Make an empty list (before the loop)",
							code: "    vector<Order> orders;",
						},
						{
							label: "Add to the end of the list",
							code: "    orders.push_back(o);",
						},
						{
							label: "Go through every item",
							code: `    for (Order o : orders) {
        cout << o.number << ": " << o.drink << endl;
    }`,
						},
						{
							label: "If the list is empty",
							code: `    if (orders.empty()) {
        cout << "No orders yet." << endl;
    }`,
						},
					],
					predict: {
						question:
							"You add Tea, then Coffee, then Cake. In what order does the for loop print them?",
						answer:
							"Tea, Coffee, Cake. push_back adds to the end, and the loop goes from the start.",
					},
				},
				order: {
					prompt: "Make a list, add Priya and then Sam, then print every name.",
					lines: [
						"vector<string> names;",
						'names.push_back("Priya");',
						'names.push_back("Sam");',
						"for (string n : names) {",
						"    cout << n << endl;",
						"}",
					],
				},
				recall: [
					{
						q: "What's a vector?",
						a: "A list that grows as you add things, and keeps them in order.",
					},
					{
						q: "How do you add s to the end of students?",
						a: "students.push_back(s);",
					},
					{
						q: "Why is the list made before the while loop?",
						a: "So there's ONE list for the whole program. Made inside the loop, it would start empty every time.",
					},
				],
			},
		},
		{
			id: "l8",
			milestoneId: "lw2",
			title: "Give each job a name",
			goal: "Reading and printing a student each live in their own function.",
			level: 2,
			concepts: ["function"],
			steps: [
				{
					text: "Above main, write void printStudent(Student s). Move your 'print one student' line into it.",
					hint: {
						text: "Like printOrder in the example.",
						code: `void printStudent(Student s) {
    cout << s.id << " | " << s.name << " | " << s.age
         << " | " << s.major << " | " << s.gpa << endl;
}`,
					},
				},
				{
					text: "Use printStudent in Add and in View all.",
					hint: {
						text: "Wherever you printed a student, write printStudent(s); instead.",
					},
				},
				{
					text: "Write Student readStudent() that asks for the 5 values and returns the student.",
					hint: {
						text: "Copy readOrder from the example. Change Order to Student and ask for every field.",
					},
				},
				{
					text: "In Add, use it: Student s = readStudent(); then push_back.",
				},
			],
			doneWhen: [
				"Add and View all work exactly as before.",
				"main() no longer has the 5 questions in it.",
			],
			lesson: {
				why: "Short, named pieces are easier to read, fix and reuse than one long main().",
				example: {
					title: "Order functions",
					blocks: [
						{
							label: "A function that prints an order (above main)",
							code: `void printOrder(Order o) {
    cout << o.number << ": " << o.cups << " x " << o.drink << endl;
}`,
						},
						{
							label: "A function that reads an order and gives it back",
							code: `Order readOrder() {
    Order o;
    cout << "Order number: ";
    cin >> o.number;
    cout << "Drink: ";
    getline(cin >> ws, o.drink);
    cout << "Cups: ";
    cin >> o.cups;
    return o;
}`,
						},
						{
							label: "Use them in main",
							code: `    Order o = readOrder();
    orders.push_back(o);
    printOrder(o);`,
						},
					],
					predict: {
						question:
							"printOrder is written above main, but main runs first. When does printOrder's code run?",
						answer:
							"Only when main calls it: printOrder(o);. Writing a function doesn't run it.",
					},
				},
				order: {
					prompt: "Write a function that says Hello!, then call it from main.",
					lines: [
						"void sayHello() {",
						'    cout << "Hello!" << endl;',
						"}",
						"int main() {",
						"    sayHello();",
						"    return 0;",
						"}",
					],
				},
				recall: [
					{
						q: "What's a function?",
						a: "A named block of code that does one job. You run it by calling its name: printStudent(s);",
					},
					{
						q: "What does return do?",
						a: "Hands a value back to whoever called the function, and ends it.",
					},
					{
						q: "Does writing a function run it?",
						a: "No. It only runs when something calls it.",
					},
				],
			},
		},
		{
			id: "l9",
			milestoneId: "lw2",
			title: "The real list, not a copy",
			goal: "Add and View all are functions that work on the one real list.",
			level: 3,
			concepts: ["reference-vs-copy"],
			steps: [
				{
					text: "Write void addStudent(vector<Student>& students) that reads a student and adds them.",
					hint: {
						code: `void addStudent(vector<Student>& students) {
    Student s = readStudent();
    students.push_back(s);
    cout << "Student added." << endl;
}`,
					},
				},
				{
					text: "Write void printAllStudents(vector<Student>& students) for View all, with the 'No students yet' message.",
					hint: {
						text: "Move your View all code into it. Keep the & here too.",
					},
				},
				{
					text: "Make main short: show the menu, read the choice, call the right function.",
					hint: {
						code: `if (choice == 1) {
    addStudent(students);
} else if (choice == 2) {
    printAllStudents(students);
}`,
					},
				},
				{
					text: "Experiment: remove the & from addStudent, run it, add a student, then View all. Then put the & back.",
					hint: {
						text: "The student should vanish. The function added them to a copy, and the copy was thrown away.",
					},
				},
			],
			doneWhen: [
				"Add and View all still work.",
				"main() fits on your screen without scrolling.",
				"You saw what happens without the & (step 4).",
			],
			lesson: {
				why: "This bug confuses everyone once. After today it won't confuse you.",
				example: {
					title: "Adding orders inside a function",
					blocks: [
						{
							label: "Without & (works on a copy)",
							code: `void addOrder(vector<Order> list) {
    list.push_back(readOrder());
}`,
						},
						{
							label: "With & (works on the real list)",
							code: `void addOrder(vector<Order>& list) {
    list.push_back(readOrder());
}`,
						},
						{ label: "Use it in main", code: "    addOrder(orders);" },
					],
					predict: {
						question:
							"With the first version (no &), you add an order, then print orders in main. What do you see?",
						answer:
							"Not the new order. The function added it to a copy, and the copy was thrown away when the function ended. With & it changes the real list.",
					},
				},
				order: {
					prompt: "A function that really adds one to x. Then print x (it shows 6).",
					lines: [
						"void addOne(int& n) {",
						"    n = n + 1;",
						"}",
						"int main() {",
						"    int x = 5;",
						"    addOne(x);",
						"    cout << x << endl;",
						"}",
					],
				},
				recall: [
					{
						q: "What does the & mean in vector<Student>& students?",
						a: "Use the real list, not a copy. Changes made in the function stick.",
					},
					{
						q: "A function adds a student, but afterwards the student is gone. Most likely cause?",
						a: "The list was passed as a copy: the & is missing.",
					},
				],
			},
		},
		{
			id: "l10",
			milestoneId: "lw2",
			title: "Review week 2",
			goal: "Everything from this week still works, and you can explain it.",
			level: 1,
			checkpoint: true,
			concepts: [],
			steps: [
				"Run the app. Add 3 students, View all, then try 7 and 0.",
				"Read your code from top to bottom. Point at each function and say out loud what it does.",
				"Back up: copy your project folder as StudentManager_W2.",
				"Fill in this week's reflection (Reflect tab).",
				{ text: "Do a stretch goal you skipped this week.", stretch: true },
			],
			doneWhen: [
				"Add and View all work.",
				"Backup made.",
				"Reflection written.",
			],
			lesson: {
				why: "Coming back to things is how they stick. That's what today is for.",
				example: null,
				order: null,
				recall: [],
			},
		},

		// --- week 3 -------------------------------------------------------------
		{
			id: "l11",
			milestoneId: "lw3",
			title: "Find a student by ID",
			goal: "Search asks for an ID and shows that student, or says they're not there.",
			level: 2,
			concepts: ["linear-search", "algorithm"],
			steps: [
				{
					text: "Write int findById(vector<Student>& students, int id), like findOrder.",
					hint: {
						code: `int findById(vector<Student>& students, int id) {
    for (int i = 0; i < students.size(); i++) {
        if (students[i].id == id) {
            return i;
        }
    }
    return -1;
}`,
						text: "students[i] is the student at position i.",
					},
				},
				{ text: "In Search (3), ask for an ID and call findById." },
				{
					text: "If it gives -1, print 'No student with ID 105' (with their number). Otherwise print the student.",
					hint: {
						code: `int pos = findById(students, id);
if (pos == -1) {
    cout << "No student with ID " << id << endl;
} else {
    printStudent(students[pos]);
}`,
					},
				},
				{
					text: "Count how many students the search looked at, and print it.",
					stretch: true,
				},
			],
			doneWhen: [
				"Search finds the first student, the last one, and one in the middle.",
				"Check: an ID that doesn't exist; searching an empty list.",
			],
			lesson: {
				why: "Almost every app searches. This is the simplest way, and it always works.",
				example: {
					title: "Find an order by its number",
					blocks: [
						{
							label: "Look at each position, one by one",
							code: `int findOrder(vector<Order>& orders, int number) {
    for (int i = 0; i < orders.size(); i++) {
        if (orders[i].number == number) {
            return i;
        }
    }
    return -1;
}`,
						},
						{
							label: "Use the answer",
							code: `    int pos = findOrder(orders, 12);
    if (pos == -1) {
        cout << "No order 12." << endl;
    } else {
        printOrder(orders[pos]);
    }`,
						},
					],
					predict: {
						question:
							"The orders are 10, 11, 12, 13. You search for 12. How many orders does the loop look at?",
						answer:
							"3. It checks 10, then 11, then finds 12 and returns straight away.",
					},
				},
				order: {
					prompt: "Give back the position of target in names, or -1.",
					lines: [
						"int findName(vector<string>& names, string target) {",
						"    for (int i = 0; i < names.size(); i++) {",
						"        if (names[i] == target) {",
						"            return i;",
						"        }",
						"    }",
						"    return -1;",
						"}",
					],
				},
				recall: [
					{
						q: "What is linear search?",
						a: "Check the items one by one from the start until you find the one you want.",
					},
					{
						q: "Why does findById give back -1?",
						a: "Positions start at 0, so -1 can't be a real position. It means 'not found'.",
					},
					{ q: "What's the position of the first item in a vector?", a: "0." },
				],
			},
		},
		{
			id: "l12",
			milestoneId: "lw3",
			title: "Search by part of a name",
			goal: "Typing pri finds Priya and PRINCE.",
			level: 3,
			concepts: ["breaking-a-problem-down", "pseudocode"],
			steps: [
				{
					text: "In Notes, write the steps in plain English first, like the example's pseudocode.",
					hint: {
						text: "No C++ yet.",
						code: `for each student:
    if their name (lowercase) contains the search (lowercase):
        print them`,
					},
				},
				{
					text: "Copy lower() and contains() from the example into your program, and add #include <cctype>.",
				},
				{
					text: 'Test them on their own: in main, print contains(lower("PRIYA"), "pri"). It should print 1.',
					hint: {
						text: "1 means true. Delete this test line once it works.",
					},
				},
				{
					text: "Add menu option 6, Search by name: ask for some text, then print every student whose name contains it.",
					hint: {
						code: `for (Student s : students) {
    if (contains(lower(s.name), lower(text))) {
        printStudent(s);
    }
}`,
					},
				},
				{
					text: "If nobody matches, print 'No matches.'",
					hint: {
						text: "Start with found = false. Set it to true when you print someone. After the loop, check it.",
						code: `bool found = false;
// in the loop, when you print someone: found = true;
if (!found) {
    cout << "No matches." << endl;
}`,
					},
				},
				{ text: "Search the major too.", stretch: true },
			],
			doneWhen: [
				"'pri' finds Priya and PRINCE.",
				"Check: a letter from the middle of a name; no matches; an empty search.",
			],
			lesson: {
				why: "Big problems feel impossible until you split them. Then each piece is small.",
				example: {
					title: "Search drinks by part of a name",
					blocks: [
						{
							label: "Steps in plain English first (pseudocode)",
							code: `// for each order:
//     make the drink name lowercase
//     make the search lowercase
//     if the name contains the search, print the order`,
						},
						{ label: "Setup", code: "#include <cctype>" },
						{
							label: "Small problem 1: make text lowercase",
							code: `string lower(string text) {
    for (char& c : text) {
        c = tolower(c);
    }
    return text;
}`,
						},
						{
							label: "Small problem 2: does one text contain another?",
							code: `bool contains(string text, string part) {
    return text.find(part) != string::npos;
}`,
						},
						{
							label: "Put them together",
							code: `    for (Order o : orders) {
        if (contains(lower(o.drink), lower(search))) {
            printOrder(o);
        }
    }`,
						},
					],
					predict: {
						question:
							"The drinks are Iced Tea, Tea and Coffee. You search TEA. What prints?",
						answer:
							"Iced Tea and Tea. Everything becomes lowercase, and both contain 'tea'.",
					},
				},
				order: {
					prompt: "Print every name that contains the letter a.",
					lines: [
						"for (string n : names) {",
						'    if (contains(n, "a")) {',
						"        cout << n << endl;",
						"    }",
						"}",
					],
				},
				recall: [
					{
						q: "What is pseudocode?",
						a: "The steps written in plain English before you write any code.",
					},
					{
						q: "How did we split 'search by part of a name'?",
						a: "1) make text lowercase, 2) check if one text contains another, 3) loop over everyone using both.",
					},
				],
			},
		},
		{
			id: "l13",
			milestoneId: "lw3",
			title: "Update a student",
			goal: "Update changes a student's details, and View all shows the new ones.",
			level: 3,
			concepts: ["dry", "big-o"],
			steps: [
				{
					text: "Write void updateStudent(vector<Student>& students). Ask for an ID and find them with findById.",
					hint: {
						text: "Don't write the search again: call findById. That's DRY.",
					},
				},
				{
					text: "If they're not found, print a message and stop.",
					hint: {
						text: "return; ends a void function straight away.",
						code: `if (pos == -1) {
    cout << "No student with ID " << id << endl;
    return;
}`,
					},
				},
				{
					text: "Get the real student, not a copy.",
					hint: {
						text: "The & matters, just like last week.",
						code: "Student& s = students[pos];",
					},
				},
				{
					text: "Show their current details, then ask for a new name, age, major and GPA.",
					hint: {
						code: `printStudent(s);
cout << "New name: ";
getline(cin >> ws, s.name);
// age, major and gpa the same way`,
					},
				},
				{
					text: "Add menu option 4 (Update) that calls updateStudent.",
				},
			],
			doneWhen: [
				"After an update, View all shows the new values.",
				"Check: an ID that doesn't exist; change every field.",
			],
			lesson: {
				why: "Once you can find something, changing it is only a few lines.",
				example: {
					title: "Change how many cups an order has",
					blocks: [
						{
							label: "Find it (reuse the search)",
							code: `    int pos = findOrder(orders, number);
    if (pos == -1) {
        cout << "No order " << number << endl;
        return;
    }`,
						},
						{
							label: "Get the real one, not a copy",
							code: "    Order& o = orders[pos];",
						},
						{
							label: "Change it",
							code: `    cout << "New cups: ";
    cin >> o.cups;`,
						},
					],
					predict: {
						question: "What if it said Order o = orders[pos]; (no &)?",
						answer:
							"The change would go to a copy. View all would still show the old cups.",
					},
				},
				order: {
					prompt: "Find student 102 and change their age to 20.",
					lines: [
						"int pos = findById(students, 102);",
						"if (pos != -1) {",
						"    Student& s = students[pos];",
						"    s.age = 20;",
						"}",
					],
				},
				recall: [
					{
						q: "What does DRY mean?",
						a: "Don't Repeat Yourself: write a piece of logic once (like findById) and reuse it.",
					},
					{
						q: "Why Student& s = students[pos]; and not Student s = students[pos];?",
						a: "With & you change the real student. Without it you change a copy and nothing sticks.",
					},
					{
						q: "If the list doubles in size, how much more checking can linear search do?",
						a: "Twice as much. Its work grows with the list. That's called O(n).",
					},
				],
			},
		},
		{
			id: "l14",
			milestoneId: "lw3",
			title: "Delete a student",
			goal: "Delete removes the right student after asking 'Are you sure?'.",
			level: 2,
			concepts: ["id-vs-position", "edge-case"],
			steps: [
				{
					text: "Write void deleteStudent(vector<Student>& students): ask for an ID and find them.",
					hint: { text: "Start it the same way as updateStudent." },
				},
				{
					text: "Show the student and ask 'Are you sure? (y/n)'.",
					hint: {
						code: `cout << "Are you sure? (y/n) ";
char answer;
cin >> answer;`,
						text: "A char holds one letter. Single quotes: 'y'.",
					},
				},
				{
					text: "If the answer is y, remove them. Otherwise print 'Nothing deleted.'",
					hint: { code: "students.erase(students.begin() + pos);" },
				},
				{ text: "Add menu option 5 (Delete) that calls deleteStudent." },
				{
					text: "Test the edge cases: delete the first student, the last, and the only one.",
					hint: {
						text: "Edge cases are the unusual spots: empty, first, last, only one. Bugs love them.",
					},
				},
				{
					text: "Delete all students, asking twice to be sure. (students.clear() empties the list.)",
					stretch: true,
				},
			],
			doneWhen: [
				"The right student is removed.",
				"Check: first, last, middle; a missing ID; answering n; deleting the only student.",
			],
			lesson: {
				why: "Deleting the wrong thing is a real-world disaster. Today you do it safely.",
				example: {
					title: "Remove an order",
					blocks: [
						{
							label: "Find it (reuse the search)",
							code: `    int pos = findOrder(orders, number);
    if (pos == -1) {
        cout << "No order " << number << endl;
        return;
    }`,
						},
						{
							label: "Ask first",
							code: `    cout << "Are you sure? (y/n) ";
    char answer;
    cin >> answer;
    if (answer != 'y') {
        cout << "Nothing deleted." << endl;
        return;
    }`,
						},
						{
							label: "Remove it from the list",
							code: "    orders.erase(orders.begin() + pos);",
						},
					],
					predict: {
						question:
							"Positions 0, 1, 2, 3 hold orders 10, 11, 12, 13. You delete order 11. What's at position 1 now?",
						answer:
							"Order 12. Everything after the deleted one moves up a place. That's why we find students by ID, never by position.",
					},
				},
				order: {
					prompt: "Ask, and only delete if the answer is y.",
					lines: [
						"char answer;",
						"cin >> answer;",
						"if (answer == 'y') {",
						"    students.erase(students.begin() + pos);",
						"}",
					],
				},
				recall: [
					{
						q: "Why find students by ID, not by position?",
						a: "Positions change when someone is removed. An ID never changes.",
					},
					{
						q: "What's an edge case?",
						a: "An unusual situation at the limits: empty list, first, last, only one, missing.",
					},
					{
						q: "How do you remove the item at position pos?",
						a: "students.erase(students.begin() + pos);",
					},
				],
			},
		},
		{
			id: "l15",
			milestoneId: "lw3",
			title: "Review: the finished Student Manager",
			goal: "All five features work, and the app has a README.",
			level: 1,
			checkpoint: true,
			concepts: ["regression-test", "documentation"],
			steps: [
				{
					text: "Re-run the checks from sessions 11–14. Does everything still work?",
					hint: {
						text: "New code can break old features. Re-testing old things is called a regression test.",
					},
				},
				{
					text: "Write README.txt: what the app does and how to use each menu option.",
					hint: {
						code: `Student Manager
Keeps a list of students.

1. Add: type the ID, name, age, major and GPA.
2. View all: shows everyone.
...`,
					},
				},
				"Back up: copy the folder as StudentManager_V1.",
				"Fill in this week's reflection (Reflect tab).",
			],
			doneWhen: [
				"Add, View all, Search, Update and Delete all work.",
				"README.txt exists.",
				"Backup made. Reflection written.",
			],
			lesson: {
				why: "You built a whole app. Today you make sure it works and that someone else could use it.",
				example: null,
				order: null,
				recall: [
					{
						q: "What's a regression test?",
						a: "Re-testing old features to check that new changes didn't break them.",
					},
					{
						q: "What goes in a README?",
						a: "What the app does and how to use it.",
					},
				],
			},
		},
	],
};
