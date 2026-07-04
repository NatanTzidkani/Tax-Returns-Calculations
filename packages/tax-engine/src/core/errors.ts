/** Base class for every error the engine throws on purpose (spec §9). */
export class TaxEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownTaxYearError extends TaxEngineError {
  constructor(public readonly year: number) {
    super(`No rule set for tax year ${year}; supported years must have a year-data file`);
  }
}

export class InvalidTaxInputError extends TaxEngineError {
  constructor(
    public readonly field: string,
    reason: string,
  ) {
    super(`Invalid tax input at "${field}": ${reason}`);
  }
}
