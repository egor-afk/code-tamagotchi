import * as vscode from 'vscode';

// Простейшая модель питомца
class Tamagotchi {
	private health: number = 100
    private hunger: number = 50;
    private happiness: number = 50;
	private level: number = 1;
	private experience: number = 0;
    
    constructor() {}

    // Метод для обновления состояния на основе активности
    updateBasedOnCodeActivity(): void {
        this.hunger = Math.max(0, this.hunger - 5);  // Голод уменьшается
        this.happiness = Math.min(100, this.happiness + 3);  // Счастье увеличивается
    }
    
    getStatus(): string {
        if (this.hunger > 70) return '😫 Голодный';
        if (this.happiness < 30) return '😞 Грустный';
        return '😊 Довольный';
    }
    
    feed(): void {
        this.hunger = Math.max(0, this.hunger - 20);
    }

	play(): void{
		this.hunger = Math.max(0, this.hunger - 5);
		this.happiness = Math.min(100, this.happiness + 20);
	}
	punish(): void {
        this.hunger = Math.min(100, this.hunger + 20);
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Tamagotchi активирован!');
    // Восстанавливаем состояние или создаем нового питомца
    const savedState = context.globalState.get('tamagotchiState');
    const pet = savedState ? 
        Object.assign(new Tamagotchi(), savedState) : 
        new Tamagotchi();
    
    
    // Создаем статус-бар элемент
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = `Питомец: ${pet.getStatus()}`;
    statusBarItem.tooltip = "Кликните, чтобы покормить питомца";
    statusBarItem.show();
    
    // Команда для кормления питомца
    const feedCommand = vscode.commands.registerCommand('code-tamagotchi.feed', () => {
        pet.feed();
        statusBarItem.text = `Питомец: ${pet.getStatus()}`;
        vscode.window.showInformationMessage('Питомец покормлен!');
    });

	const playCommand = vscode.commands.registerCommand('code-tamagotchi.play', () => {
        pet.play();
        statusBarItem.text = `Питомец: ${pet.getStatus()}`;
        vscode.window.showInformationMessage('Вы поиграли с питомцем!');
    });

	const punishCommand = vscode.commands.registerCommand('code-tamagotchi.punish', () => {
        pet.punish();
        statusBarItem.text = `Питомец: ${pet.getStatus()}`;
        vscode.window.showInformationMessage('Питомец наказан!');
    });

     // Сохраняем состояние при изменении
    const saveState = () => {
        context.globalState.update('tamagotchiState', {
            hunger: pet['hunger'],
            happiness: pet['happiness']
        });
    };

    // Отслеживаем написание кода
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument(() => {
        pet.updateBasedOnCodeActivity();
        statusBarItem.text = `Питомец: ${pet.getStatus()}`;
		saveState();
    });

    // Добавляем в контекст для удаления при деактивации
    context.subscriptions.push(statusBarItem, feedCommand, textChangeDisposable);
}

export function deactivate() {}