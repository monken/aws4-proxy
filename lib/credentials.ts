interface EnvCredentialsOptions {
  secretAccessKey: string;
  accessKeyId: string;
  sessionToken?: string;
};

export class EnvCredentials implements AWS.Credentials {
  secretAccessKey: string;

  accessKeyId: string;

  sessionToken: string;

  expired: boolean;

  expireTime: Date;

  constructor(args: EnvCredentialsOptions) {
    this.secretAccessKey = args.secretAccessKey;
    this.accessKeyId = args.accessKeyId;
    this.sessionToken = args.sessionToken === undefined ? '' : args.sessionToken;
    this.expired = false;
    this.expireTime = new Date(Date.now() + 43200);
  }

  get() {
    const { secretAccessKey, accessKeyId, sessionToken } = this;
    return { secretAccessKey, accessKeyId, sessionToken };
  }

  async getPromise() {
    return;
  }

  needsRefresh() {
    return false;
  }

  refresh(callback: (err: AWS.AWSError) => void) {
  }

  async refreshPromise() {
    return;
  }
}
