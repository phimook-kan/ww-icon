import { Schema, model, models, Model, Types } from "mongoose";

export interface IIcon {
  _id: Types.ObjectId;          // = iconId
  iconUrl: string;
  iconRole: string;
  iconSet?: Types.ObjectId;     // ไม่บังคับ
  createAt: Date;
}

const IconSchema = new Schema<IIcon>(
  {
    iconUrl: { type: String, required: true, unique: true, trim: true },
    iconRole: { type: String, required: true, trim: true, lowercase: true, index: true },
    iconSet: { type: Schema.Types.ObjectId, ref: "IconSet", required: false },
  },
  {
    timestamps: { createdAt: "createAt", updatedAt: false },
    versionKey: false,
  }
);

export const Icon: Model<IIcon> =
  (models.Icon as Model<IIcon>) || model<IIcon>("Icon", IconSchema);