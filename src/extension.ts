import * as vscode from 'vscode';
import { Tamagotchi } from './tamagotchi';

let pet: Tamagotchi;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log('Code Tamagotchi активирован!');

    pet = new Tamagotchi(context);
    
    // Создаем статус-бар элемент
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    updateStatusBar();
    statusBarItem.show();
    
    // Команда для кормления питомца
    const feedCommand = vscode.commands.registerCommand('code-tamagotchi.feed', () => {
        pet.feed();
        updateStatusBar();
        vscode.window.showInformationMessage('Питомец покормлен!');
    });

	const playCommand = vscode.commands.registerCommand('code-tamagotchi.play', () => {
        pet.play();
        updateStatusBar();
        vscode.window.showInformationMessage('Вы поиграли с питомцем!');
    });

	const clearCommand = vscode.commands.registerCommand('code-tamagotchi.clear', () => {
        pet.clear();
        updateStatusBar();
        vscode.window.showInformationMessage('Вы очистили историю!');
    });

	const punishCommand = vscode.commands.registerCommand('code-tamagotchi.punish', () => {
        pet.punish();
        updateStatusBar();
        vscode.window.showInformationMessage('Питомец наказан!');
    });

    // Отслеживаем написание кода
    vscode.workspace.onDidChangeTextDocument((event) => {
    // event содержит информацию об изменениях
    event.contentChanges.forEach(change => {
        const addedText = change.text;
        const newLines = (addedText.match(/\n/g) || []).length;
        
        if (newLines > 0) {
            pet.onCodeWritten(newLines); // Передаем количество новых строк
            updateStatusBar();
        }
    });
});

    // Добавляем в контекст для удаления при деактивации
    context.subscriptions.push(statusBarItem, feedCommand, playCommand, punishCommand);
}

function updateStatusBar() {
    if (pet && statusBarItem) {
        const emoji = pet.getMoodEmoji();
        statusBarItem.text = `${emoji} Тамагочи`;
        statusBarItem.tooltip = pet.getStatusText();
    }
}

export function deactivate() {
}