import inquirer from 'inquirer';
import { exec } from 'child_process';
import { Solution } from './aiAnalyzer';
import pc from 'picocolors';

export class Executor {
  async promptAndExecute(solutions: Solution[], onComplete: () => void) {
    if (solutions.length === 0) {
      console.log(pc.yellow('\nZervox found no automated solutions. Please check logs manually.'));
      process.exit(1);
    }

    const choices = solutions.map(s => ({
      name: `${pc.bold(s.description)} ${s.command ? pc.gray(`[${s.command}]`) : ''}`,
      value: s
    }));

    choices.push({
      name: pc.red('❌ Ignore & Exit'),
      value: { id: -1, description: 'Exit', action: 'EXIT' } as any
    });

    const { selectedSolution } = await inquirer.prompt<{ selectedSolution: Solution }>([
      {
        type: 'list',
        name: 'selectedSolution',
        message: '👉  How do you want to handle this crash?',
        choices,
      }
    ]);

    if (selectedSolution.id === -1 || selectedSolution.action as any === 'EXIT') {
      console.log(pc.gray('Exiting Zervox...'));
      process.exit(1);
    }

    await this.applySolution(selectedSolution);
    onComplete(); // Trigger Restart
  }

  private async applySolution(solution: Solution): Promise<void> {
    return new Promise((resolve) => {
      console.log(pc.cyan(`\n🛠️  Applying fix: ${solution.description}...`));
      
      if (solution.action === 'RUN_COMMAND' && solution.command) {
        console.log(pc.gray(`$ ${solution.command}`));
        exec(solution.command, (error, stdout, stderr) => {
          if (error) {
            console.error(pc.red(`Failed to execute: ${error.message}`));
          }
          if (stdout) console.log(pc.gray(stdout));
          if (stderr) console.error(pc.gray(stderr));
          resolve();
        });
      } else if (solution.action === 'EDIT_ENV' && solution.key && solution.value) {
        // Simple hack: Export the env var for the next spawned process
        process.env[solution.key] = solution.value;
        console.log(pc.green(`✅ Set ${solution.key}=${solution.value}`));
        resolve();
      } else {
        console.log(pc.yellow('Action not supported yet by Executor.'));
        resolve();
      }
    });
  }
}
