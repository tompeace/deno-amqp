import { FieldType } from "./field-types.ts";

const textEncoder = new TextEncoder();

export function createEncoder() {
  const buffer = new Deno.Buffer();

  function encodeOctet(value: number) {
    if (value < 0 || value > 0xff) {
      throw new Error("Invalid value for octet");
    }

    buffer.writeSync(new Uint8Array([value]));
  }

  function encodeShortUint(value: number) {
    if (value < 0 || value > 0xffff) {
      throw new Error("Invalid value for short-uint");
    }

    buffer.writeSync(new Uint8Array([value >>> 8, value]));
  }

  function encodeLongUint(value: number) {
    if (value < 0 || value > 0xffffffff) {
      throw new Error("Invalid value for long-uint");
    }

    buffer.writeSync(
      new Uint8Array([value >>> 24, value >>> 16, value >>> 8, value])
    );
  }

  function encodeLongLongUint(value: number) {
    throw new Error("Not implemented");
  }

  function encodeShortString(value: string) {
    const encoded = textEncoder.encode(value);

    if (encoded.length > 255) {
      throw new Error("Value is too long for short string");
    }

    buffer.writeSync(new Uint8Array([encoded.length, ...encoded]));
  }

  function encodeLongString(value: string) {
    const encoded = textEncoder.encode(value);

    if (encoded.length > 0xffffffff) {
      throw new Error("Value is too long for long string");
    }

    encodeLongUint(encoded.length);
    buffer.writeSync(encoded);
  }

  function encodeTable(table: Record<string, unknown>) {
    const encoder = createEncoder();
    for (const fieldName of Object.keys(table)) {
      const value = table[fieldName];

      if (typeof value === "number") {
        encoder.encodeShortString(fieldName);
        encoder.encodeOctet(FieldType.LongUInt);
        encoder.encodeLongUint(value);
        continue;
      }

      if (typeof value === "string") {
        encoder.encodeShortString(fieldName);
        const encodedString = textEncoder.encode(value);
        if (encodedString.length <= 255) {
          encoder.encodeOctet(FieldType.ShortStr);
          encoder.encodeOctet(encodedString.length);
          encoder.write(encodedString);
        } else {
          encoder.encodeOctet(FieldType.LongStr);
          encoder.encodeLongUint(encodedString.length);
          encoder.write(encodedString);
        }
        continue;
      }

      if (Array.isArray(value)) {
        throw new Error("Don't know how to encode array fields yet");
      }

      if (typeof value === "object") {
        encoder.encodeShortString(fieldName);
        encoder.encodeOctet(FieldType.FieldTable);
        encoder.encodeTable(value as Record<string, unknown>);
        break;
      }

      throw new Error(
        `Don't know how to encode field of type ${typeof value} yet`
      );
    }

    const result = encoder.bytes();
    encodeLongUint(result.length);
    buffer.writeSync(result);
  }

  return {
    encodeTable,
    encodeOctet,
    encodeShortUint,
    encodeLongUint,
    encodeLongLongUint,
    encodeLongString,
    encodeShortString,
    write: (bytes: Uint8Array) => buffer.writeSync(bytes),
    bytes: () => buffer.bytes()
  };
}