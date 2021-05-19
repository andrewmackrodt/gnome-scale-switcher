import { spawn } from 'child_process'

export interface ConsoleResult {
    stdout?: string
    stderr?: string
    exitCode: number
}

export interface ConsoleOptions {
    trimEndingNewline?: boolean
}

export async function exec(
    command: string,
    args: string[] = [],
    options?: ConsoleOptions,
): Promise<ConsoleResult> {
    const childProcess = spawn(command, args)

    return new Promise((resolve, reject) => {
        const res: Partial<ConsoleResult> = {}

        childProcess.on('error', error => {
            try {
                childProcess.kill('SIGKILL')
            } catch (e) {
                console.error(e)
            }

            reject(error)
        })

        childProcess.stdout.on('data', (data: Buffer) => {
            if (typeof res.stdout === 'undefined') {
                res.stdout = ''
            }
            res.stdout += data.toString()
        })

        childProcess.stderr.on('data', (data: Buffer) => {
            if (typeof res.stderr === 'undefined') {
                res.stderr = ''
            }
            res.stderr += data.toString()
        })

        childProcess.on('close', exitCode => {
            res.exitCode = exitCode ?? 0
            if (options?.trimEndingNewline && typeof res.stdout === 'string') {
                res.stdout = res.stdout.replace(/\r?\n$/, '')
            }
            if (options?.trimEndingNewline && typeof res.stderr === 'string') {
                res.stderr = res.stderr.replace(/\r?\n$/, '')
            }
            resolve(res as ConsoleResult)
        })
    })
}

export async function execOrFail(
    command: string,
    args: string[] = [],
    options?: ConsoleOptions,
): Promise<ConsoleResult> {
    const result = await exec(command, args, options)

    if (result.exitCode !== 0) {
        let message: string | undefined =
            [
                result.stderr,
                result.stdout,
            ]
                .filter(s => typeof s === 'string' && s.length > 0).join('\n')
        if (message.length === 0) {
            message = undefined
        }

        throw new Error(message)
    }

    return result
}
