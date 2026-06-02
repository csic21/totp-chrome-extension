const WIRE_TYPE_VARINT = 0;
const WIRE_TYPE_FIXED64 = 1;
const WIRE_TYPE_LENGTH_DELIMITED = 2;
const WIRE_TYPE_FIXED32 = 5;

const textDecoder = new TextDecoder();

export enum GoogleMigrationAlgorithm {
  ALGO_INVALID = 0,
  ALGO_SHA1 = 1,
}

export enum GoogleMigrationOtpType {
  OTP_INVALID = 0,
  OTP_HOTP = 1,
  OTP_TOTP = 2,
}

export type GoogleMigrationOtpParameter = {
  secret?: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: GoogleMigrationAlgorithm;
  digits?: number;
  type?: GoogleMigrationOtpType;
  counter?: bigint;
};

type ProtobufTag = {
  fieldNumber: number;
  wireType: number;
};

class ProtobufReader {
  private offset = 0;

  constructor(private readonly data: Uint8Array) {}

  get isDone() {
    return this.offset >= this.data.length;
  }

  readTag(): ProtobufTag | null {
    if (this.isDone) {
      return null;
    }

    const tag = this.readVarintNumber();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;

    if (fieldNumber === 0) {
      throw new Error("Invalid protobuf field number");
    }

    return { fieldNumber, wireType };
  }

  readVarint(): bigint {
    let result = 0n;
    let shift = 0n;

    for (let index = 0; index < 10; index += 1) {
      const byte = this.readByte();
      result |= BigInt(byte & 0x7f) << shift;

      if ((byte & 0x80) === 0) {
        return result;
      }

      shift += 7n;
    }

    throw new Error("Invalid protobuf varint");
  }

  readVarintNumber(): number {
    const value = this.readVarint();

    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Protobuf number exceeds safe integer range");
    }

    return Number(value);
  }

  readLengthDelimited(): Uint8Array {
    const length = this.readVarintNumber();
    const end = this.offset + length;

    if (end > this.data.length) {
      throw new Error("Invalid protobuf length-delimited field");
    }

    const value = this.data.subarray(this.offset, end);
    this.offset = end;
    return value;
  }

  skip(wireType: number) {
    switch (wireType) {
      case WIRE_TYPE_VARINT:
        this.readVarint();
        return;
      case WIRE_TYPE_FIXED64:
        this.skipBytes(8);
        return;
      case WIRE_TYPE_LENGTH_DELIMITED:
        this.readLengthDelimited();
        return;
      case WIRE_TYPE_FIXED32:
        this.skipBytes(4);
        return;
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }

  private readByte(): number {
    if (this.offset >= this.data.length) {
      throw new Error("Unexpected end of protobuf data");
    }

    const byte = this.data[this.offset];
    this.offset += 1;
    return byte;
  }

  private skipBytes(length: number) {
    const end = this.offset + length;

    if (end > this.data.length) {
      throw new Error("Unexpected end of protobuf data");
    }

    this.offset = end;
  }
}

const decodeBase64 = (data: string): Uint8Array => {
  const normalizedData = data
    .trim()
    .replace(/\s/g, "+")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const paddedData = normalizedData.padEnd(
    Math.ceil(normalizedData.length / 4) * 4,
    "=",
  );
  const binaryData = atob(paddedData);

  return Uint8Array.from(binaryData, (char) => char.charCodeAt(0));
};

const readString = (reader: ProtobufReader) =>
  textDecoder.decode(reader.readLengthDelimited());

const decodeOtpParameter = (data: Uint8Array): GoogleMigrationOtpParameter => {
  const reader = new ProtobufReader(data);
  const parameter: GoogleMigrationOtpParameter = {};

  while (!reader.isDone) {
    const tag = reader.readTag();
    if (!tag) break;

    switch (tag.fieldNumber) {
      case 1:
        if (tag.wireType === WIRE_TYPE_LENGTH_DELIMITED) {
          parameter.secret = reader.readLengthDelimited();
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 2:
        if (tag.wireType === WIRE_TYPE_LENGTH_DELIMITED) {
          parameter.name = readString(reader);
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 3:
        if (tag.wireType === WIRE_TYPE_LENGTH_DELIMITED) {
          parameter.issuer = readString(reader);
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 4:
        if (tag.wireType === WIRE_TYPE_VARINT) {
          parameter.algorithm =
            reader.readVarintNumber() as GoogleMigrationAlgorithm;
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 5:
        if (tag.wireType === WIRE_TYPE_VARINT) {
          parameter.digits = reader.readVarintNumber();
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 6:
        if (tag.wireType === WIRE_TYPE_VARINT) {
          parameter.type = reader.readVarintNumber() as GoogleMigrationOtpType;
        } else {
          reader.skip(tag.wireType);
        }
        break;
      case 7:
        if (tag.wireType === WIRE_TYPE_VARINT) {
          parameter.counter = reader.readVarint();
        } else {
          reader.skip(tag.wireType);
        }
        break;
      default:
        reader.skip(tag.wireType);
    }
  }

  return parameter;
};

export const decodeGoogleMigrationPayload = (
  data: string,
): GoogleMigrationOtpParameter[] => {
  const reader = new ProtobufReader(decodeBase64(data));
  const otpParameters: GoogleMigrationOtpParameter[] = [];

  while (!reader.isDone) {
    const tag = reader.readTag();
    if (!tag) break;

    if (
      tag.fieldNumber === 1 &&
      tag.wireType === WIRE_TYPE_LENGTH_DELIMITED
    ) {
      otpParameters.push(decodeOtpParameter(reader.readLengthDelimited()));
    } else {
      reader.skip(tag.wireType);
    }
  }

  return otpParameters;
};
