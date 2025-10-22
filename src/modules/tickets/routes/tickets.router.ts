import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';
import TicketModel, { TicketStatus } from '../models/ticket.model.js';
import NoteModel from '../models/note.model.js';

class TicketsRouter extends EnduranceRouter {
    constructor() {
        super(EnduranceAuthMiddleware.getInstance());
    }

    setupRoutes(): void {
        const authenticatedOptions: SecurityOptions = {
            requireAuth: true,
            permissions: []
        };

        // Lister mes tickets
        this.get('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const tickets = await TicketModel.find({ createdBy: req.user._id })
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .sort({ updatedAt: -1 })
                    .exec();
                res.json(tickets);
            } catch (error) {
                console.error('Erreur lors de la récupération des tickets:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer un ticket par ID
        this.get('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOne({
                    _id: req.params.id,
                    createdBy: req.user._id
                })
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                res.json(ticket);
            } catch (error) {
                console.error('Erreur lors de la récupération du ticket:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Créer un nouveau ticket
        this.post('/', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = new TicketModel({
                    ...req.body,
                    createdBy: req.user._id,
                    status: 'OUVERT'
                });
                await ticket.save();

                // Émettre un événement pour la création d'un ticket
                enduranceEmitter.emit(enduranceEventTypes.TICKET_CREATED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    ticketData: {
                        title: ticket.title,
                        category: ticket.category
                    }
                });

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                res.status(201).json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de la création du ticket:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Modifier un ticket
        this.put('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOne({
                    _id: req.params.id,
                    createdBy: req.user._id
                }).exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                // Sauvegarder les données avant modification pour l'événement
                const previousData = {
                    title: ticket.title,
                    description: ticket.description,
                    category: ticket.category,
                    status: ticket.status
                };

                Object.assign(ticket, req.body);
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour la modification d'un ticket
                enduranceEmitter.emit(enduranceEventTypes.TICKET_UPDATED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    previousData,
                    newData: {
                        title: ticket.title,
                        description: ticket.description,
                        category: ticket.category,
                        status: ticket.status
                    }
                });

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                res.json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de la modification du ticket:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Fermer un ticket
        this.post('/:id/close', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOne({
                    _id: req.params.id,
                    createdBy: req.user._id
                }).exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                ticket.status = TicketStatus.CLOSED;
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour la fermeture d'un ticket
                enduranceEmitter.emit(enduranceEventTypes.TICKET_CLOSED, {
                    userId: req.user._id,
                    ticketId: ticket._id
                });

                const populatedTicket = await TicketModel.findById(ticket._id)
                    .populate('assignedTo', 'firstname lastname email')
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                res.json(populatedTicket);
            } catch (error) {
                console.error('Erreur lors de la fermeture du ticket:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Récupérer les notes d'un ticket
        this.get('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOne({
                    _id: req.params.id,
                    createdBy: req.user._id
                }).exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                const notes = await NoteModel.find({ ticketId: req.params.id })
                    .populate('createdBy', 'firstname lastname email')
                    .sort({ createdAt: -1 })
                    .exec();

                res.json(notes);
            } catch (error) {
                console.error('Erreur lors de la récupération des notes:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Ajouter une note à un ticket
        this.post('/:id/notes', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOne({
                    _id: req.params.id,
                    createdBy: req.user._id
                }).exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                const note = new NoteModel({
                    content: req.body.content,
                    createdBy: req.user._id,
                    ticketId: req.params.id
                });
                await note.save();

                // Ajouter la référence de la note au ticket
                ticket.notes.push(note._id);
                ticket.updatedAt = new Date();
                await ticket.save();

                // Émettre un événement pour l'ajout d'une note
                enduranceEmitter.emit(enduranceEventTypes.TICKET_NOTE_ADDED, {
                    userId: req.user._id,
                    ticketId: ticket._id,
                    noteId: note._id
                });

                const populatedNote = await NoteModel.findById(note._id)
                    .populate('createdBy', 'firstname lastname email')
                    .exec();

                res.status(201).json(populatedNote);
            } catch (error) {
                console.error('Erreur lors de l\'ajout de la note:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });

        // Supprimer un ticket
        this.delete('/:id', authenticatedOptions, async (req: any, res: any) => {
            try {
                const ticket = await TicketModel.findOneAndDelete({
                    _id: req.params.id,
                    createdBy: req.user._id
                }).exec();

                if (!ticket) {
                    return res.status(404).json({ error: 'Ticket non trouvé' });
                }

                // Supprimer toutes les notes associées
                await NoteModel.deleteMany({ ticketId: ticket._id });

                // Émettre un événement pour la suppression d'un ticket
                enduranceEmitter.emit(enduranceEventTypes.TICKET_DELETED, {
                    userId: req.user._id,
                    ticketId: ticket._id
                });

                res.status(204).send();
            } catch (error) {
                console.error('Erreur lors de la suppression du ticket:', error);
                res.status(500).json({ error: 'Erreur interne du serveur' });
            }
        });
    }
}

const router = new TicketsRouter();
export default router;
