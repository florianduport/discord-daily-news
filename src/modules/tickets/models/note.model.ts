import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Note extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public content!: string;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public createdAt!: Date;

    @EnduranceModelType.prop({ required: true, ref: 'User' })
    public createdBy!: ObjectId;

    @EnduranceModelType.prop({ required: true, ref: 'Ticket' })
    public ticketId!: ObjectId;

    public static getModel() {
        return NoteModel;
    }
}

const NoteModel = EnduranceModelType.getModelForClass(Note);
export default NoteModel;
