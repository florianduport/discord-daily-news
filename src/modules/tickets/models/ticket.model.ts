import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';
import { Types } from 'mongoose';

export enum TicketCategory {
    TECHNICAL_SUPPORT = 'ASSISTANCE_TECHNIQUE',
    HR_QUESTION = 'QUESTION_RH',
    PURCHASE_REQUEST = 'DEMANDE_ACHAT'
}

export enum TicketStatus {
    OPEN = 'OUVERT',
    IN_PROGRESS = 'EN_COURS',
    CLOSED = 'FERME'
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
@EnduranceModelType.pre<Ticket>('save', async function (this: Ticket, next) {
    try {
        this.category = this.category.toUpperCase() as TicketCategory;
        this.status = this.status.toUpperCase() as TicketStatus;
        next();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        next(new Error('Erreur lors du pré-enregistrement: ' + errorMessage));
    }
})
class Ticket extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public title!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ required: true, enum: TicketCategory })
    public category!: TicketCategory;

    @EnduranceModelType.prop({ required: true, ref: 'User' })
    public createdBy!: ObjectId;

    @EnduranceModelType.prop({ required: false, ref: 'User' })
    public assignedTo?: ObjectId;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Note', default: [] })
    public notes!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [String], default: [] })
    public attachments!: string[];

    @EnduranceModelType.prop({ required: true, enum: TicketStatus, default: TicketStatus.OPEN })
    public status!: TicketStatus;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public createdAt!: Date;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public updatedAt!: Date;

    public static getModel() {
        return TicketModel;
    }
}

const TicketModel = EnduranceModelType.getModelForClass(Ticket);
export default TicketModel;
