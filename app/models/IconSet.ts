import { Schema, model, models, Model, Types } from "mongoose";

export interface IIconSet {
  _id: Types.ObjectId;          // = iconSetId
  iconSetName: string;
  icon: Types.ObjectId[];       // array ของ iconId
  createAt: Date;
}

const IconSetSchema = new Schema<IIconSet>(
  {
    iconSetName: { type: String, required: true, trim: true, unique: true },
    icon: [{ type: Schema.Types.ObjectId, ref: "Icon" }],
  },
  {
    timestamps: { createdAt: "createAt", updatedAt: false },
    versionKey: false,
  }
);

export const IconSet: Model<IIconSet> =
  (models.IconSet as Model<IIconSet>) || model<IIconSet>("IconSet", IconSetSchema);