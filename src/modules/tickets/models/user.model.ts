import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';

// Modèle User simplifié pour le module tickets (sans dépendances)
@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class TicketsUser extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, unique: true })
    public email!: string;

    @EnduranceModelType.prop({ required: true })
    public firstname!: string;

    @EnduranceModelType.prop({ required: true })
    public lastname!: string;

    @EnduranceModelType.prop({ required: false, default: true })
    public isActive!: boolean;

    public static getModel() {
        return TicketsUserModel;
    }
}

const TicketsUserModel = EnduranceModelType.getModelForClass(TicketsUser);

export default TicketsUserModel;
export type UserDocument = EnduranceDocumentType<TicketsUser>;
