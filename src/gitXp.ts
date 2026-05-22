import * as vscode from 'vscode';
import type { Tamagotchi } from './tamagotchi';

const XP_COMMIT = 5;
const XP_PUSH = 10;

interface GitBranchHead {
	readonly commit?: string;
	readonly ahead?: number;
}

interface GitRepositoryState {
	readonly HEAD: GitBranchHead | undefined;
	readonly onDidChange: vscode.Event<void>;
}

/*Репозиторий Git API */
interface GitRepository {
	readonly rootUri: vscode.Uri;
	readonly state: GitRepositoryState;
	readonly onDidCommit: vscode.Event<void>;
	readonly onDidPush?: vscode.Event<void>;
}

interface GitApi {
	readonly repositories: GitRepository[];
	readonly onDidOpenRepository: vscode.Event<GitRepository>;
}

interface GitExtensionExports {
	getAPI(version: 1): GitApi;
}

interface HeadSnapshot {
	commit?: string;
	ahead?: number;
}

function readHeadSnapshot(repo: GitRepository): HeadSnapshot {
	const h = repo.state.HEAD;
	if (!h) {
		return {};
	}
	return { commit: h.commit, ahead: h.ahead };
}

/*
  Git-интеграция
  Коммит: {GitRepository.onDidCommit}.
  Пуш: {GitRepository.onDidPush}, если есть; иначе запасной вариант по уменьшению {GitBranchHead.ahead}.
 */
export function registerGitExperienceRewards(
	pet: Tamagotchi,
	onPetUpdated: () => void
): vscode.Disposable {
	const disposables: vscode.Disposable[] = [];
	let disposed = false;

	const wireApi = (git: GitApi) => {
		if (disposed) {
			return;
		}

		const headSnapshots = new Map<string, HeadSnapshot>();

		const subscribeToRepo = (repo: GitRepository) => {
			const key = repo.rootUri.fsPath;
			headSnapshots.set(key, readHeadSnapshot(repo));

			disposables.push(
				repo.onDidCommit(() => {
					if (disposed) {
						return;
					}
					pet.addExperience(XP_COMMIT, 'Коммит в Git');
					onPetUpdated();
				})
			);

			if (typeof repo.onDidPush === 'function') {
				disposables.push(
					repo.onDidPush(() => {
						if (disposed) {
							return;
						}
						pet.addExperience(XP_PUSH, 'Пуш в Git');
						onPetUpdated();
					})
				);
			} else {
				disposables.push(
					repo.state.onDidChange(() => {
						if (disposed) {
							return;
						}
						const prev = headSnapshots.get(key) ?? {};
						const cur = readHeadSnapshot(repo);
						const prevAhead = prev.ahead;
						const curAhead = cur.ahead;
						if (
							prev.commit &&
							cur.commit === prev.commit &&
							typeof prevAhead === 'number' &&
							typeof curAhead === 'number' &&
							curAhead < prevAhead
						) {
							pet.addExperience(XP_PUSH, 'Пуш в Git');
							onPetUpdated();
						}
						headSnapshots.set(key, cur);
					})
				);
			}
		};

		git.repositories.forEach((repo) => subscribeToRepo(repo));
		disposables.push(git.onDidOpenRepository((repo) => subscribeToRepo(repo)));
	};

	const gitExtension = vscode.extensions.getExtension<GitExtensionExports>('vscode.git');
	if (!gitExtension) {
		console.warn('[code-tamagotchi] Расширение vscode.git не найдено — XP за Git недоступен.');
		return { dispose: () => {} };
	}

	void gitExtension.activate().then(() => {
		if (disposed) {
			return;
		}
		try {
			const git = gitExtension.exports.getAPI(1);
			wireApi(git);
		} catch (err) {
			console.warn('[code-tamagotchi] Не удалось получить Git API:', err);
		}
	});

	return new vscode.Disposable(() => {
		disposed = true;
		for (const d of disposables) {
			d.dispose();
		}
	});
}
