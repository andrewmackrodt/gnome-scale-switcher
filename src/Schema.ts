import { execOrFail } from './shell'

export class Schema {
    public constructor(
        protected readonly schema: string,
    ) {
    }

    public async get(key: string): Promise<string> {
        let { stdout } = await execOrFail('gsettings', ['get', this.schema, key], { trimEndingNewline: true })

        if (stdout === '@as []') {
            stdout = '[]'
        }

        return stdout!
    }

    public async set(key: string, value: string): Promise<void> {
        await execOrFail('gsettings', ['set', this.schema, key, value], { trimEndingNewline: true })
    }
}
