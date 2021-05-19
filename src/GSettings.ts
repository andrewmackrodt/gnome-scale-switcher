import { Schema } from './Schema'

export class GSettings {
    public schema(schema: string): Schema {
        return new Schema(schema)
    }
}
