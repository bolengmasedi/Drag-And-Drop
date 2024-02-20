/*
    App Manager: Drag and Drop
*/

// Drag and Drop Interface
interface Draggable {
    dragStartHandler(event: DragEvent): void;
    dragEndHandler(event: DragEvent): void;
}

interface DragTarget {
    dragOverHandler(event: DragEvent): void;
    dropHandler(event: DragEvent): void;
    dragLeaveHandler(event: DragEvent): void;
}

// Project State Management
type Listener<T> = (items: T[]) => void;

class State<T> {
    // Array of functions references  to be called when the state changes.
    protected listeners: Listener<T>[] = [];

    addListener(listenerFn: Listener<T>) {
        this.listeners.push(listenerFn);
    }
}

// Set up a subscription pattern in the class to manage the list of listeners/functions called when something changes
class ProjectState extends State<Project>{
    private projects: Project[] = [];
    private static instance: ProjectState;

    // Using a private constructor guarantees that its a singleton class
    private constructor() {
        super();
    }

    static getInstance() {
        if(this.instance) {
            return this.instance
        }
        this.instance = new ProjectState();
        return this.instance;
    }

    // Add a new project to the list of projects.
    addProject(projectName: string, projectDescription: string, numPeople: number) {
        const newProject = new Project(
            Math.random().toString(), 
            projectName,
            projectDescription,
            numPeople,
            ProjectStatus.Active,
        );
        this.projects.push(newProject);
        this.updateListeners();
    };

    moveProject(projectId: string, newStatus: ProjectStatus) {
        const project = this.projects.find(project => project.id === projectId);
        if(project && project.status !== newStatus) {
            project.status = newStatus;
            this.updateListeners();
        }
    }

    // Updating leads to the list re-rendering objects
    updateListeners() {
        for(const listenerFn of this.listeners) {
            // slice to return a copy of that array and not the original array. So that project list cant be edited
            listenerFn(this.projects.slice());
        }
    }
}

// Create an instance of global state: A singleton of the project state
const projectState = ProjectState.getInstance();

// Autobind decorator
function Autobind(_: any, _2: string, descriptor: PropertyDescriptor) {
    let method = descriptor.value;
    const adjustedDescriptor: PropertyDescriptor = {
        configurable: true,
        get() {
            const boundFunction = method.bind(this)
            return boundFunction;
        }
    }
    return adjustedDescriptor;
};

// Validation
interface Validatable {
    value: string | number;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
}

function validateInput(validatableInput: Validatable) {
    let isValid = true;
    if(validatableInput.required) {
        isValid = isValid && validatableInput.value.toString().trim().length !== 0;
    }
    if(validatableInput.minLength != null && typeof validatableInput.value === 'string') {
        isValid = isValid && validatableInput.value.length > validatableInput.minLength;
    }
    if(validatableInput.maxLength != null && typeof validatableInput.value === 'string') {
        isValid = isValid && validatableInput.value.length < validatableInput.maxLength;
    }
    if(validatableInput.min != null && typeof validatableInput.value === 'number') {
        isValid = isValid && validatableInput.value > validatableInput.min;
    }
    if(validatableInput.max != null && typeof validatableInput.value === 'number') {
        isValid = isValid && validatableInput.value < validatableInput.max;
    }
    return isValid
}

enum ProjectStatus { Active, Finished }

class Project {
    constructor(
        public id: string, 
        public title: string, 
        public description: string, 
        public people: number,
        public status: ProjectStatus,
    ) { }
}

// Component Base Class: UI Componnents with functionality allowing us to render it
// Creating a generic abstract class that we can inherit from but should never be instantiated
abstract class Component<T extends HTMLElement, U extends HTMLElement> {
    templateElement: HTMLTemplateElement;
    hostElement: T;
    element: U;

    constructor(templateId: string, hostElementId: string,  insertAtStart: boolean, newElementId?: string) {
        this.templateElement = document.getElementById(templateId) as HTMLTemplateElement;
        this.hostElement = document.getElementById(hostElementId)! as T;

        // Import the content of the template
        const importContent = document.importNode(this.templateElement.content, true);

        // Get the form element
        this.element = importContent.firstElementChild as U;
        if(newElementId) {
            this.element.id = newElementId;
        }

        this.attach(insertAtStart);
    }


    private attach(insertAtStart: boolean) {
        this.hostElement.insertAdjacentElement(insertAtStart ? 'afterbegin' : "beforeend", this.element);
    }

   abstract configure(): void;
   abstract renderContent(): void;
}

class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {
    private project: Project;

    get people () { 
        if(this.project.people === 1) {
            return '1 person';
        }
        return `${this.project.people} people`; 
    }

    constructor(hostElementId: string, project: Project) {
        super("single-project", hostElementId, false, project.id);
        this.project = project;
        this.configure();
        this.renderContent();
    }

    @Autobind
    dragStartHandler(event: DragEvent): void {
        event.dataTransfer!.setData('text/plain', this.project.id);
        event.dataTransfer!.effectAllowed = 'move';
    }
    
    dragEndHandler(_: DragEvent): void {
        console.log('DragEnd')
    }

    configure() {
        this.element.addEventListener('dragstart', this.dragStartHandler);
    }

    renderContent() {
        this.element.querySelector('h2')! .textContent = this.project.title;
        this.element.querySelector('h3')! .textContent = this.people + ' assigned';
        this.element.querySelector('p')! .textContent = this.project.description;
    }
}

class ProjectList extends Component<HTMLDivElement, HTMLElement> implements DragTarget {
    assignedProjects: any[];

    constructor(private type: 'active' | 'finished') {
        super('project-list', 'app', false, `${type}-projects`)
        this.assignedProjects = [];

        this.configure();
        this.renderContent();
    }

    @Autobind
    dragOverHandler(event: DragEvent): void {
        if(event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
            event.preventDefault();
            const listElement = this.element.querySelector('ul')!; 
            listElement.classList.add('droppable');
        }
    }

    @Autobind
    dropHandler(event: DragEvent): void {
        const projectId = event.dataTransfer!.getData('text/plain');
        projectState.moveProject(projectId, this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished);
    }

    @Autobind
    dragLeaveHandler(_: DragEvent): void {
        const listElement = this.element.querySelector('ul')!; 
        listElement.classList.remove('droppable');
    }

    renderContent() {
        const listId = `${this.type}-projects-list`;
        this.element.querySelector('ul')!.id = listId;
        this.element.querySelector('h2')!.textContent = this.type.toUpperCase() + " PROJECTS";
    }

    configure() {
        // Before attaching and rendering the content: Add listeners from project state
        this.element.addEventListener('dragover', this.dragOverHandler);
        this.element.addEventListener('dragleave', this.dragLeaveHandler);
        this.element.addEventListener('drop', this.dropHandler);

        projectState.addListener((projects: Project[]) => {
            const relevantProjects = projects.filter(project => {
                if(this.type === 'active') {
                    return project.status === ProjectStatus.Active;
                }
                return project.status === ProjectStatus.Finished;
            })
            this.assignedProjects = relevantProjects;
            this.renderProjects();
        })
    }

    private renderProjects() {
        const listElement = document.getElementById(`${this.type}-projects-list`)! as HTMLUListElement;
        listElement.innerHTML = '';
        for (const item of this.assignedProjects) {
            new ProjectItem(this.element.querySelector('ul')!.id, item);
        }
    }
}

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
    titleInputElement: HTMLInputElement;
    descInputElement: HTMLInputElement;
    peopleInputElement: HTMLInputElement;
    constructor() {
        super('project-input', 'app', true, 'user-input')

        // Get access to elements in the form
        this.titleInputElement = this.element.querySelector('#title') as HTMLInputElement;
        this.descInputElement = this.element.querySelector('#description') as HTMLInputElement;
        this.peopleInputElement = this.element.querySelector('#people') as HTMLInputElement;

        // Add listeners
        this.configure();
    }

    // Add event listeners
    configure() {
        this.element.addEventListener('submit', this.submitHandler);
    }

    renderContent() {}

    @Autobind
    private submitHandler(event: Event) {
        event.preventDefault();         // This would trigger HTTP request
        const userInput = this.getUserInput();
        if(Array.isArray(userInput)) { 
            const [title, description, people] = userInput;
            projectState.addProject(title, description, people);
            this.clearUserInput();
        }
    }

    // Get and validate user input
    private getUserInput(): [string, string, number] | void {
        const title = this.titleInputElement.value;
        const description = this.descInputElement.value;
        const people = Number(this.peopleInputElement.value);

        const titleValidatable: Validatable = {
            value: title,
            required: true,
        };
        const descriptionValidatable: Validatable = {
            value: description,
            required: true,
            minLength: 5,
        };
        const peopleValidatable: Validatable = {
            value: +people,
            required: true,
            min: 1,
            max: 5,
        };

        if (
            !validateInput(titleValidatable) && 
            !validateInput(descriptionValidatable) && 
            !validateInput(peopleValidatable)) {
            alert('Input is invalid. Please try again.');
            return;
        } else {
            return [title, description, people];
        }
    }

    private clearUserInput() {
        this.titleInputElement.value = '';
        this.descInputElement.value = '';
        this.peopleInputElement.value = '';
     }
}

const projectInput = new ProjectInput();
const activeProjectList = new ProjectList('active');
const finishedProjectList = new ProjectList('finished');